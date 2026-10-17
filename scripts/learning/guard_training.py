"""Resume a suspended Windows learner while yielding to GPU and host-memory pressure."""

import argparse
import ctypes
import json
from pathlib import Path
import time

from gpu_budget import Memory, Utilization


class HostMemory(ctypes.Structure):
    _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong),
                ("total", ctypes.c_ulonglong), ("available", ctypes.c_ulonglong),
                ("pageTotal", ctypes.c_ulonglong), ("pageAvailable", ctypes.c_ulonglong),
                ("virtualTotal", ctypes.c_ulonglong), ("virtualAvailable", ctypes.c_ulonglong),
                ("extendedAvailable", ctypes.c_ulonglong)]


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    record = Path(args.pause_record)
    paused = json.loads(record.read_text(encoding="utf-8-sig"))
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    native = ctypes.WinDLL("ntdll")
    kernel.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_bool, ctypes.c_ulong]
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
    kernel.GlobalMemoryStatusEx.argtypes = [ctypes.POINTER(HostMemory)]
    for function in (native.NtSuspendProcess, native.NtResumeProcess):
        function.argtypes = [ctypes.c_void_p]
        function.restype = ctypes.c_long
    handles = [(item["ProcessId"], kernel.OpenProcess(0x1800, False, item["ProcessId"]))
               for item in paused["processes"]]
    if any(not handle for _, handle in handles):
        raise RuntimeError("Cannot open all suspended learner processes")
    nvml = ctypes.WinDLL("nvml.dll")
    if nvml.nvmlInit_v2():
        raise RuntimeError("Cannot initialize NVML")
    gpu = ctypes.c_void_p()
    if nvml.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(gpu)):
        raise RuntimeError("Cannot open GPU zero")
    (output / "config.json").write_text(json.dumps({**vars(args), "processes": paused["processes"],
        "gpuCeilingPercent": 90}, indent=2), encoding="utf-8")
    suspended = True
    peak = 0
    samples = 0
    next_log = 0
    resume_after = 0
    try:
        with (output / "metrics.jsonl").open("x", encoding="utf-8") as log:
            while True:
                live = []
                for pid, handle in handles:
                    code = ctypes.c_ulong()
                    if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)):
                        raise ctypes.WinError(ctypes.get_last_error())
                    if code.value == 259:
                        live.append((pid, handle))
                if not live:
                    break
                utilization, memory = Utilization(), Memory()
                if nvml.nvmlDeviceGetUtilizationRates(gpu, ctypes.byref(utilization)) \
                        or nvml.nvmlDeviceGetMemoryInfo(gpu, ctypes.byref(memory)):
                    raise RuntimeError("Cannot read GPU resource pressure")
                host = HostMemory()
                host.length = ctypes.sizeof(host)
                if not kernel.GlobalMemoryStatusEx(ctypes.byref(host)):
                    raise ctypes.WinError(ctypes.get_last_error())
                free_mib = host.available / 1048576
                now = time.monotonic()
                change = None
                if not suspended and (utilization.gpu >= args.pause_at or free_mib < args.pause_memory_mib):
                    change = True
                elif suspended and now >= resume_after and utilization.gpu <= args.resume_at \
                        and free_mib >= args.resume_memory_mib:
                    change = False
                if change is not None:
                    operation = native.NtSuspendProcess if change else native.NtResumeProcess
                    for _, handle in live:
                        status = operation(handle)
                        if status:
                            raise RuntimeError(f"Learner process control failed with NTSTATUS {status}")
                    suspended = change
                    resume_after = now + 3
                    paused.update(state="paused-by-resource-guard" if suspended else "running-under-resource-guard",
                                  updatedAt=time.time(), guard=str(output))
                    record.write_text(json.dumps(paused, indent=2), encoding="utf-8")
                samples += 1
                peak = max(peak, utilization.gpu)
                if change is not None or now >= next_log:
                    row = {"time": time.time(), "gpuPercent": utilization.gpu,
                           "gpuMemoryMiB": memory.used / 1048576, "hostAvailableMiB": free_mib,
                           "suspended": suspended, "activePids": [pid for pid, _ in live]}
                    log.write(json.dumps(row) + "\n")
                    log.flush()
                    next_log = now + 1
                time.sleep(.2)
        (output / "result.json").write_text(json.dumps({"state": "learner-exited", "samples": samples,
            "gpuPeakPercent": peak}, indent=2), encoding="utf-8")
    finally:
        nvml.nvmlShutdown()
        for _, handle in handles:
            kernel.CloseHandle(handle)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pause-record", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--pause-at", type=int, default=70)
    parser.add_argument("--resume-at", type=int, default=45)
    parser.add_argument("--pause-memory-mib", type=int, default=1024)
    parser.add_argument("--resume-memory-mib", type=int, default=1400)
    main(parser.parse_args())

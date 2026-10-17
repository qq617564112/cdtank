"""Coordinate CUDA work with the training host's observed GPU utilization."""

import ctypes
import json
import os
import time


class Utilization(ctypes.Structure):
    _fields_ = [("gpu", ctypes.c_uint), ("memory", ctypes.c_uint)]


class Memory(ctypes.Structure):
    _fields_ = [("total", ctypes.c_ulonglong), ("free", ctypes.c_ulonglong),
                ("used", ctypes.c_ulonglong)]


class GpuBudget:
    """Yield CUDA submission windows and cool down before the requested ceiling."""

    def __init__(self, limit, output):
        if not 10 <= limit <= 90:
            raise ValueError("GPU utilization limit must be between 10 and 90 percent")
        self.limit = limit
        self.library = ctypes.WinDLL("nvml.dll") if os.name == "nt" else ctypes.CDLL("libnvidia-ml.so.1")
        self.check(self.library.nvmlInit_v2())
        self.handle = ctypes.c_void_p()
        self.check(self.library.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(self.handle)))
        self.next_sample = 0
        self.next_log = 0
        self.cooling = False
        self.utilization = 0
        self.paused_seconds = 0
        self.drained_seconds = 0
        self.log = (output / "gpu.jsonl").open("x", encoding="utf-8")
        # All processes on this host use the same monotonic-clock windows.
        self.window = .1
        self.duty = max(.01, (limit - 12) / 100)

    @staticmethod
    def check(result):
        if result:
            raise RuntimeError(f"NVML call failed with status {result}")

    def wait(self):
        import torch

        before = time.monotonic()
        torch.cuda.synchronize()
        drained = time.monotonic() - before
        self.drained_seconds += drained
        # A long recurrent kernel can finish beyond its submission window.
        # Account for that work before admitting the next CUDA operation.
        if drained > self.window * (1 - self.duty):
            before = time.monotonic()
            time.sleep(drained * (1 - self.duty) / self.duty)
            self.paused_seconds += time.monotonic() - before
        while True:
            now = time.monotonic()
            if now >= self.next_sample:
                utilization, memory = Utilization(), Memory()
                self.check(self.library.nvmlDeviceGetUtilizationRates(self.handle, ctypes.byref(utilization)))
                self.check(self.library.nvmlDeviceGetMemoryInfo(self.handle, ctypes.byref(memory)))
                self.utilization = utilization.gpu
                if self.utilization >= self.limit - 2:
                    self.cooling = True
                elif self.utilization <= self.limit - 7:
                    self.cooling = False
                self.next_sample = now + .2
                if now >= self.next_log:
                    self.log.write(json.dumps({"time": time.time(), "gpuPercent": self.utilization,
                        "memoryMiB": memory.used / 1048576, "totalMemoryMiB": memory.total / 1048576,
                        "limitPercent": self.limit, "submissionDutyPercent": self.duty * 100,
                        "cooling": self.cooling, "pausedSeconds": self.paused_seconds,
                        "cudaDrainSeconds": self.drained_seconds}) + "\n")
                    self.log.flush()
                    self.next_log = now + 1
            phase = now % self.window
            if not self.cooling and phase < self.window * self.duty:
                return
            # Drain submitted work before yielding, including work from backward().
            torch.cuda.synchronize()
            delay = .05 if self.cooling else self.window - phase
            before = time.monotonic()
            time.sleep(delay)
            self.paused_seconds += time.monotonic() - before

    def close(self):
        self.log.close()
        self.check(self.library.nvmlShutdown())

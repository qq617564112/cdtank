import {useEffect, useRef, useState} from 'react';
import type {ConnectionPreferences} from '../../../../shared/contracts/connection';
import {testConnection} from '../../network/connection-preferences';
import {desktopClient} from '../../platform/desktop';
import {GameButton} from '../resources/game-button';
import {CartoonInput} from '../resources/cartoon-controls';
import {SettingsChoice} from './settings-controls';
import './connection-settings.css';

interface ConnectionSettingsProps {
  value: ConnectionPreferences;
  onChange: (value: ConnectionPreferences) => void;
  disabled: boolean;
  onTestingChange: (testing: boolean) => void;
}

export function ConnectionSettings({value, onChange, disabled, onTestingChange}: ConnectionSettingsProps) {
  const desktop = desktopClient();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(desktop?.initialState.startupError ?? '');
  const generation = useRef(0);
  useEffect(() => () => {generation.current++;}, []);
  function change(next: ConnectionPreferences): void {
    generation.current++;
    setTesting(false);
    setStatus('');
    onChange(next);
  }
  async function test(): Promise<void> {
    const request = ++generation.current;
    setTesting(true);
    onTestingChange(true);
    setStatus('正在测试游戏连接…');
    try {
      const milliseconds = await testConnection(value);
      if (request === generation.current) setStatus(`连接成功，往返 ${milliseconds} ms。`);
    } catch (error) {
      if (request === generation.current) setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (request === generation.current) {setTesting(false); onTestingChange(false);}
    }
  }
  return <section className="settings-connection" aria-label="连接设置">
    <h3>运行模式</h3>
    <div className="settings-connection-modes" role="group" aria-label="运行模式">
      <SettingsChoice kind="radio" checked={value.mode === 'local'} disabled={disabled || !desktop || testing}
        title={desktop ? '在本机开服，允许其他桌面客户端加入' : '本地模式需要桌面客户端'}
        onClick={() => change({...value, mode: 'local'})}>本地开服</SettingsChoice>
      <SettingsChoice kind="radio" checked={value.mode === 'remote'} disabled={disabled || testing}
        onClick={() => change({...value, mode: 'remote'})}>远程连接</SettingsChoice>
    </div>
    {value.mode === 'remote' ? <>
      <label htmlFor="settings-server-url">服务器地址</label>
      <CartoonInput id="settings-server-url" width={530} height={42}
        value={value.serverUrl} disabled={disabled || testing} spellCheck={false}
        autoComplete="off" inputMode="url" placeholder="192.168.10.100:3001 或 https://tank.example.com"
        onChange={event => change({...value, serverUrl: event.currentTarget.value})}/>
      <p>{desktop ? '填写主机的 IP 和端口即可加入游戏。' : '默认连接当前网页所在的服务器。'}</p>
    </> : <>
      <p>在这台电脑上运行服务器，其他桌面客户端可通过以下地址加入：</p>
      <div className="settings-connection-addresses">
        {(desktop?.initialState.lanUrls.length ? desktop.initialState.lanUrls : [desktop?.initialState.localUrl ?? ''])
          .map(url => <input key={url} aria-label="主机连接地址" value={url} readOnly onFocus={event => event.currentTarget.select()}/>)}
      </div>
    </>}
    <GameButton disabled={disabled || testing} onClick={() => {void test();}}>
      {testing ? '测试中…' : '测试连接'}
    </GameButton>
    <p className="settings-connection-status" role="status" aria-live="polite">{status}</p>
    <p className="settings-connection-save">点击下方“确定”保存；切换连接后返回登录页。</p>
  </section>;
}

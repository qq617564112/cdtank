import {contextBridge, ipcRenderer} from 'electron';
import type {ConnectionPreferences, DesktopClient} from '../../shared/contracts/connection';
import type {LocalCurrencyCredit} from '../../shared/contracts/local-currency';

const client: DesktopClient = {
  initialState: ipcRenderer.sendSync('desktop:state'),
  applyConnection: (preferences: ConnectionPreferences) => ipcRenderer.invoke('desktop:apply', preferences),
  testConnection: (preferences: ConnectionPreferences) => ipcRenderer.invoke('desktop:test', preferences),
  creditLocalCurrency: (credit: LocalCurrencyCredit) => ipcRenderer.invoke('desktop:credit-currency', credit),
};
contextBridge.exposeInMainWorld('cdtankDesktop', client);

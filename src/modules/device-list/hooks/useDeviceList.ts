import { useState, useCallback, useMemo, useEffect } from 'react';
import type { BleDeviceInfo, SortConfig, SortOption } from '../types';
import {
  startScan,
  stopScan,
  connect,
  disconnect,
  readCharacteristic,
  writeCharacteristic,
  getDevices,
  fetchDevices,
} from '../services/deviceListService';

const initialSortConfig: SortConfig = {
  option: 'rssi',
  direction: 'desc',
};

export function useDeviceList() {
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSortConfig);
  const [lastConnectedTime, setLastConnectedTime] = useState<{ [key: string]: number }>({});
  const [loadingRead, setLoadingRead] = useState<string | null>(null);
  const [loadingWrite, setLoadingWrite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchDevices();
        if (!cancelled) {
          setDevices(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch devices');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDeviceFound = useCallback((device: BleDeviceInfo) => {
    setDevices(prev => {
      const next = new Map<string, BleDeviceInfo>();
      prev.forEach(d => next.set(d.id, d));
      next.set(device.id, device);
      return Array.from(next.values());
    });
  }, []);

  const onDeviceUpdated = useCallback((device: BleDeviceInfo) => {
    setDevices(prev => {
      const next = new Map<string, BleDeviceInfo>();
      prev.forEach(d => next.set(d.id, d));
      next.set(device.id, device);
      return Array.from(next.values());
    });
  }, []);

  const onScanStopped = useCallback(() => {
    setIsScanning(false);
  }, []);

  const onError = useCallback((err: Error) => {
    setError(err.message);
    setIsScanning(false);
  }, []);

  const handleStartScan = useCallback(async () => {
    setError(null);
    setIsScanning(true);
    try {
      await startScan(
        [],
        onDeviceFound,
        onDeviceUpdated,
        onScanStopped,
        onError
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setIsScanning(false);
    }
  }, [onDeviceFound, onDeviceUpdated, onScanStopped, onError]);

  const handleStopScan = useCallback(() => {
    stopScan();
    setIsScanning(false);
    setDevices(getDevices());
  }, []);

  const handleToggleScan = useCallback(async () => {
    console.log('handleToggleScan called. isScanning:', isScanning);
    if (isScanning) {
      handleStopScan();
    } else {
      await handleStartScan();
    }
  }, [isScanning, handleStartScan, handleStopScan]);

  const handleRefresh = useCallback(async () => {
    setDevices([]);
    setError(null);
    if (isScanning) {
      stopScan();
    }
    await handleStartScan();
  }, [isScanning, handleStartScan]);

  const handleConnectionChange = useCallback((id: string, status: BleDeviceInfo['connectionStatus']) => {
    setDevices(prev =>
      prev.map(d =>
        d.id === id ? { ...d, connectionStatus: status } : d
      )
    );
    if (status === 'connected') {
      setLastConnectedTime(prev => ({ ...prev, [id]: Date.now() }));
    }
  }, []);

  const handleConnect = useCallback(async (deviceId: string) => {
    setError(null);
    try {
      await connect(deviceId, handleConnectionChange);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [handleConnectionChange]);

  const handleDisconnect = useCallback(async (deviceId: string) => {
    setError(null);
    try {
      await disconnect(deviceId, handleConnectionChange);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }, [handleConnectionChange]);

  const handleReadData = useCallback(async (deviceId: string, serviceUUID: string, characteristicUUID: string) => {
    setError(null);
    setLoadingRead(deviceId);
    try {
      const data = await readCharacteristic(deviceId, serviceUUID, characteristicUUID);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Read failed');
      return null;
    } finally {
      setLoadingRead(null);
    }
  }, []);

  const handleWriteData = useCallback(async (
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ) => {
    setError(null);
    setLoadingWrite(deviceId);
    try {
      await writeCharacteristic(deviceId, serviceUUID, characteristicUUID, value);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Write failed');
      return false;
    } finally {
      setLoadingWrite(null);
    }
  }, []);

  const handleSetSortOption = useCallback((option: SortOption) => {
    setSortConfig(prev => ({
      option,
      direction: prev.option === option && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const filteredAndSortedDevices = useMemo(() => {
    const filtered = searchQuery.trim()
      ? devices.filter(d =>
        (d.name?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : [...devices];

    const { option, direction } = sortConfig;
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (option) {
        case 'rssi':
          comparison = (a.rssi ?? -Infinity) - (b.rssi ?? -Infinity);
          break;
        case 'name':
          comparison = (a.name ?? '').localeCompare(b.name ?? '');
          break;
        case 'lastConnected':
          const aTime = lastConnectedTime[a.id] ?? a.lastConnected ?? 0;
          const bTime = lastConnectedTime[b.id] ?? b.lastConnected ?? 0;
          comparison = aTime - bTime;
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [devices, searchQuery, sortConfig, lastConnectedTime]);

  return {
    devices: filteredAndSortedDevices,
    allDevices: devices,
    isScanning,
    searchQuery,
    sortConfig,
    loadingRead,
    loadingWrite,
    error,
    lastConnectedTime,
    handleToggleScan,
    handleStartScan,
    handleStopScan,
    handleRefresh,
    handleSearchChange: setSearchQuery,
    handleSetSortOption,
    handleConnect,
    handleDisconnect,
    handleReadData,
    handleWriteData,
    handleDismissError,
  };
}

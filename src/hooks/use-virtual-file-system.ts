// src/hooks/use-virtual-file-system.ts
import { useEffect, useRef } from "react";
// Import fs directly for type usage and configureSingle
import { configureSingle } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
// Import the Zustand store
import { useVfsStore } from "@/store/vfs.store";

/**
 * Hook to manage the lifecycle of the ZenFS filesystem instance based on
 * the state derived from the selected sidebar item (managed in useVfsStore).
 * It configures/reconfigures the global `fs` object from '@zenfs/core'.
 * It updates the operational state (ready, loading, error) in the Zustand store.
 * It does NOT perform file operations directly; those are handled by actions
 * in useVfsStore which call functions from vfs-operations.ts.
 */
export function useVirtualFileSystemManager(): void {
  // Select necessary state and actions from the store
  const vfsKey = useVfsStore((s) => s.vfsKey);
  const isEnabled = useVfsStore((s) => s.isVfsEnabledForItem);
  const globalEnableVfs = useVfsStore((s) => s.enableVfs);
  const setVfsLoading = useVfsStore((s) => s.setVfsLoading);
  const setVfsOperationLoading = useVfsStore((s) => s.setVfsOperationLoading);
  const setVfsError = useVfsStore((s) => s.setVfsError);
  const setVfsReady = useVfsStore((s) => s.setVfsReady);
  const setConfiguredVfsKey = useVfsStore((s) => s.setConfiguredVfsKey);
  const isReady = useVfsStore((s) => s.isVfsReady); // Needed for checks
  const currentConfiguredVfsKey = useVfsStore((s) => s.configuredVfsKey); // Needed for checks

  const isMountedRef = useRef(false);
  const configuringForVfsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    console.log(
      `[VFS Manager Hook] Effect triggered. VFS Key: ${vfsKey}, IsEnabledForItem: ${isEnabled}, GlobalEnable: ${globalEnableVfs}`,
    );

    const configureNewFs = async (key: string) => {
      if (!isMountedRef.current) return;

      console.log(
        `[VFS Manager Hook] Configuring global fs for VFS key: ${key} using configureSingle`,
      );
      configuringForVfsKeyRef.current = key;

      // Update store state: Start loading, clear errors/readiness
      setVfsLoading(true);
      setVfsOperationLoading(false); // Reset operation loading too
      setVfsError(null);
      setVfsReady(false);
      setConfiguredVfsKey(null); // Clear configured key until success

      try {
        const vfsConf = {
          backend: IndexedDB,
          name: `litechat_vfs_${key}`, // Unique DB per key
        };
        // Configure the *global* fs instance provided by @zenfs/core
        await configureSingle(vfsConf);

        // Check if the state is still relevant after async configuration
        const currentVfsKeyInStore = useVfsStore.getState().vfsKey;
        if (
          isMountedRef.current &&
          configuringForVfsKeyRef.current === key &&
          currentVfsKeyInStore === key // Ensure the target key hasn't changed again
        ) {
          // Update store state: Configuration successful
          setConfiguredVfsKey(key); // Set the key that was successfully configured
          setVfsReady(true);
          setVfsError(null);
          console.log(
            `[VFS Manager Hook] Global fs configured successfully for ${key}. Store updated.`,
          );
        } else {
          console.log(
            `[VFS Manager Hook] Configuration for ${key} finished, but hook/store state changed (mounted: ${isMountedRef.current}, target: ${currentVfsKeyInStore}, configuredFor: ${configuringForVfsKeyRef.current}). Store state not updated for ready.`,
          );
          // If the target key changed, ensure readiness is false
          if (currentVfsKeyInStore !== key) {
            setVfsReady(false);
            setConfiguredVfsKey(null);
          }
        }
      } catch (err) {
        console.error(
          `[VFS Manager Hook] Configuration failed for ${key}:`,
          err,
        );
        const currentVfsKeyInStore = useVfsStore.getState().vfsKey;
        // Only update error if the failed key is still the target key
        if (isMountedRef.current && currentVfsKeyInStore === key) {
          const errorMsg = `Failed to initialize filesystem: ${err instanceof Error ? err.message : String(err)}`;
          setVfsError(errorMsg);
          setVfsReady(false);
          setConfiguredVfsKey(null);
        }
      } finally {
        // Only stop loading if this specific configuration attempt is finishing
        if (configuringForVfsKeyRef.current === key) {
          setVfsLoading(false);
          configuringForVfsKeyRef.current = null;
        }
      }
    };

    // Determine if VFS should be active based on global flag and item-specific flag
    const shouldBeActive = globalEnableVfs && isEnabled && vfsKey;

    if (shouldBeActive) {
      // If the target key is different from the currently configured one, reconfigure
      if (vfsKey !== currentConfiguredVfsKey) {
        console.log(
          `[VFS Manager Hook] Target key '${vfsKey}' differs from configured '${currentConfiguredVfsKey}'. Reconfiguring.`,
        );
        configureNewFs(vfsKey);
      } else {
        // Already configured for the correct key, ensure state is consistent
        console.log(
          `[VFS Manager Hook] Already configured for target key '${vfsKey}'. Ensuring store state is ready.`,
        );
        if (!isReady) setVfsReady(true); // Ensure ready state is true
        setVfsLoading(false); // Ensure loading is false
        setVfsError(null); // Ensure no errors
      }
    } else {
      // VFS should not be active (disabled globally, disabled for item, or no item selected)
      console.log(
        `[VFS Manager Hook] VFS should not be active. Clearing ready state and configured key.`,
      );
      if (isReady) setVfsReady(false);
      if (currentConfiguredVfsKey !== null) setConfiguredVfsKey(null);
      // Clear other states if they were potentially set
      setVfsLoading(false);
      setVfsOperationLoading(false);
      setVfsError(null);
      // Note: We don't need to explicitly "unmount" or "disconnect" the global fs.
      // Subsequent calls to configureSingle will handle replacing the backend.
    }

    // Cleanup function
    return () => {
      console.log("[VFS Manager Hook] Unmounting or dependencies changed.");
      isMountedRef.current = false;
      // Optional: If a configuration was in progress when unmounting, log it.
      if (configuringForVfsKeyRef.current) {
        console.log(
          `[VFS Manager Hook] Unmounted while configuration for ${configuringForVfsKeyRef.current} might be in progress.`,
        );
      }
    };
    // Dependencies: The hook reacts to changes in the target VFS key,
    // the item-specific enabled flag, and the global VFS flag.
  }, [
    vfsKey,
    isEnabled,
    globalEnableVfs,
    setVfsLoading,
    setVfsOperationLoading,
    setVfsError,
    setVfsReady,
    setConfiguredVfsKey,
    currentConfiguredVfsKey, // Include to detect when config needs changing
    isReady, // Include to ensure consistency checks run
  ]);

  // This hook doesn't return anything as it only manages the FS instance lifecycle
  // and updates the Zustand store. Components will use useVfsStore directly
  // to get state and trigger operation actions.
}

// src/hooks/use-virtual-file-system.ts
import { useEffect, useRef } from "react";
import { configureSingle, fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import { useVfsStore } from "@/store/vfs.store";
import { toast } from "sonner";

/**
 * Hook to manage the lifecycle of the ZenFS filesystem instance.
 * Receives key state values as arguments to ensure reactivity.
 */
export function useVirtualFileSystemManager(
  vfsKey: string | null, // Argument
  isEnabled: boolean, // Argument (isVfsEnabledForItem)
  globalEnableVfs: boolean, // Argument
): void {
  // Select only actions and state needed *within* the hook's logic
  const setVfsLoading = useVfsStore((s) => s.setVfsLoading);
  const setVfsOperationLoading = useVfsStore((s) => s.setVfsOperationLoading);
  const setVfsError = useVfsStore((s) => s.setVfsError);
  const setVfsReady = useVfsStore((s) => s.setVfsReady);
  const setConfiguredVfsKey = useVfsStore((s) => s.setConfiguredVfsKey);
  const _setFsInstance = useVfsStore((s) => s._setFsInstance);

  const isMountedRef = useRef(false);
  const configuringForVfsKeyRef = useRef<string | null>(null);
  const lastPropsRef = useRef({ vfsKey, isEnabled, globalEnableVfs });

  // Force a more verbose logging to debug the issue
  console.log(
    `[VFS Manager Hook] RENDER with props: vfsKey=${vfsKey}, isEnabled=${isEnabled}, globalEnableVfs=${globalEnableVfs}`,
  );

  useEffect(() => {
    isMountedRef.current = true;

    // Log changes in props to help debug
    if (
      lastPropsRef.current.vfsKey !== vfsKey ||
      lastPropsRef.current.isEnabled !== isEnabled ||
      lastPropsRef.current.globalEnableVfs !== globalEnableVfs
    ) {
      console.log(
        `[VFS Manager Hook] PROPS CHANGED:
        - vfsKey: ${lastPropsRef.current.vfsKey} -> ${vfsKey}
        - isEnabled: ${lastPropsRef.current.isEnabled} -> ${isEnabled}
        - globalEnableVfs: ${lastPropsRef.current.globalEnableVfs} -> ${globalEnableVfs}`,
      );
      lastPropsRef.current = { vfsKey, isEnabled, globalEnableVfs };
    }

    console.log(
      `[VFS Manager Hook] === Effect Run ===
` +
        `  - Target Key (vfsKey): ${vfsKey}
` +
        `  - Enabled For Item (isEnabled): ${isEnabled}
` +
        `  - Global VFS Enabled (globalEnableVfs): ${globalEnableVfs}
` +
        `  - Current Configured Key: ${useVfsStore.getState().configuredVfsKey}
` +
        `  - Is Ready: ${useVfsStore.getState().isVfsReady}
` +
        `  - Is Loading: ${useVfsStore.getState().isVfsLoading}`,
    );

    const configureNewFs = async (key: string) => {
      console.log(
        `[VFS Manager Hook] configureNewFs called for key: ${key}. Current configuringRef: ${configuringForVfsKeyRef.current}`,
      );

      if (!isMountedRef.current) {
        console.log(
          `[VFS Manager Hook] configureNewFs aborted (unmounted) for key: ${key}`,
        );
        return;
      }
      if (configuringForVfsKeyRef.current === key) {
        console.log(
          `[VFS Manager Hook] configureNewFs skipped (already configuring) for key: ${key}`,
        );
        return;
      }
      if (configuringForVfsKeyRef.current !== null) {
        console.log(
          `[VFS Manager Hook] configureNewFs skipped (another config running: ${configuringForVfsKeyRef.current}) for key: ${key}`,
        );
        return;
      }

      console.log(
        `[VFS Manager Hook] Starting configuration process for VFS key: ${key}`,
      );
      configuringForVfsKeyRef.current = key;

      setVfsLoading(true);
      setVfsOperationLoading(false);
      setVfsError(null);
      setVfsReady(false);
      setConfiguredVfsKey(null);
      _setFsInstance(null);

      try {
        const vfsConf = {
          backend: IndexedDB,
          name: `litechat_vfs_${key}`,
        };
        console.log(
          `[VFS Manager Hook] Calling configureSingle for key: ${key} with config:`,
          vfsConf,
        );
        await configureSingle(vfsConf);
        console.log(
          `[VFS Manager Hook] configureSingle SUCCESS for key: ${key}`,
        );

        // Re-fetch the target key from the store *after* await
        const currentTargetKey = useVfsStore.getState().vfsKey;
        console.log(
          `[VFS Manager Hook] Post-config check for key: ${key}. Mounted: ${isMountedRef.current}, Current Target Key: ${currentTargetKey}`,
        );
        if (isMountedRef.current && currentTargetKey === key) {
          _setFsInstance(fs);
          setConfiguredVfsKey(key);
          // Set ready state last to ensure all other state is set first
          setVfsReady(true);
          console.log(
            `[VFS Manager Hook] State updated for SUCCESS (Ready: true) for key: ${key}`,
          );
        } else {
          console.log(
            `[VFS Manager Hook] State changed during config for key: ${key}. NOT setting Ready state.`,
          );
          if (currentTargetKey !== key) {
            setVfsReady(false);
            setConfiguredVfsKey(null);
            _setFsInstance(null);
          }
        }
      } catch (err) {
        console.error(
          `[VFS Manager Hook] configureSingle FAILED for key: ${key}:`,
          err,
        );
        // Re-fetch the target key from the store *after* await
        const currentTargetKey = useVfsStore.getState().vfsKey;
        if (isMountedRef.current && currentTargetKey === key) {
          const errorMsg = `Failed to initialize filesystem: ${err instanceof Error ? err.message : String(err)}`;
          setVfsError(errorMsg);
          setVfsReady(false);
          setConfiguredVfsKey(null);
          _setFsInstance(null);
          toast.error(errorMsg);
          console.log(
            `[VFS Manager Hook] State updated for FAILURE (Ready: false) for key: ${key}`,
          );
        }
      } finally {
        if (configuringForVfsKeyRef.current === key) {
          setVfsLoading(false);
          configuringForVfsKeyRef.current = null;
          console.log(
            `[VFS Manager Hook] Loading state set to false for key: ${key}`,
          );
        }
      }
    };

    const shouldBeActive = globalEnableVfs && isEnabled && vfsKey;
    console.log(
      `[VFS Manager Hook] Calculated shouldBeActive: ${shouldBeActive}`,
    );

    if (shouldBeActive) {
      console.log(
        `[VFS Manager Hook] Condition: Should be active. Comparing target key '${vfsKey}' with configured key '${useVfsStore.getState().configuredVfsKey}'.`,
      );
      if (vfsKey !== useVfsStore.getState().configuredVfsKey) {
        console.log(
          `[VFS Manager Hook] Keys differ. Checking if already configuring: ${configuringForVfsKeyRef.current}`,
        );
        if (configuringForVfsKeyRef.current === null) {
          configureNewFs(vfsKey);
        } else {
          console.log(
            `[VFS Manager Hook] Delaying config for ${vfsKey} because ${configuringForVfsKeyRef.current} is running.`,
          );
        }
      } else {
        console.log(
          `[VFS Manager Hook] Keys match ('${vfsKey}'). Ensuring state consistency.`,
        );
        // Use direct store reads for latest state within the effect
        const latestStoreState = useVfsStore.getState();
        if (!latestStoreState.isVfsReady) setVfsReady(true);
        if (latestStoreState.isVfsLoading) setVfsLoading(false);
        if (latestStoreState.vfsError) setVfsError(null);
        if (!latestStoreState.fs) _setFsInstance(fs);
      }
    } else {
      console.log(
        `[VFS Manager Hook] Condition: Should NOT be active. Clearing state.`,
      );
      // Use direct store reads for latest state before setting
      const latestStoreState = useVfsStore.getState();
      if (latestStoreState.isVfsReady) setVfsReady(false);
      if (latestStoreState.configuredVfsKey !== null) setConfiguredVfsKey(null);
      if (latestStoreState.fs) _setFsInstance(null);
      if (latestStoreState.isVfsLoading) setVfsLoading(false);
      setVfsOperationLoading(false);
      setVfsError(null);
    }

    return () => {
      console.log("[VFS Manager Hook] Cleanup function running.");
      isMountedRef.current = false;
    };
  }, [
    // Include the actual props in the dependency array
    vfsKey,
    isEnabled,
    globalEnableVfs,
    // Include the actions
    setVfsLoading,
    setVfsOperationLoading,
    setVfsError,
    setVfsReady,
    setConfiguredVfsKey,
    _setFsInstance,
  ]);
}

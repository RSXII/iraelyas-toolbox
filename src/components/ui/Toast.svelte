<script lang="ts">
  import { toastState } from '@/state/toast.svelte';
</script>

<div id="toast" class:show={toastState.visible}>{toastState.message}</div>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    children: Snippet;
  }

  let { id, children }: Props = $props();
</script>

<!-- openModal/closeModal in modules/ui/modal.ts toggle the .open class on this element -->
<div class="modal-overlay" {id}>
  {@render children()}
</div>

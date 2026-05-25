<script lang="ts">
  interface Action {
    text: string;
    onclick: () => void;
  }

  interface Props {
    message: string;
    action?: Action;
    type: 'warning' | 'info';
    ondismiss: () => void;
  }

  let { message, action, type, ondismiss }: Props = $props();
</script>

<div class="banner banner-{type}" role="status">
  <span class="banner-message">{message}</span>
  {#if action}
    <button class="banner-action" onclick={action.onclick}>{action.text}</button>
  {/if}
  <button class="banner-dismiss" onclick={ondismiss} aria-label="Dismiss">✕</button>
</div>

// Reactive toast state — consumed by Toast.svelte, driven by showToast()
export const toastState = $state({ message: "", visible: false });

let _timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string): void {
  toastState.message = msg;
  toastState.visible = true;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    toastState.visible = false;
  }, 2600);
}

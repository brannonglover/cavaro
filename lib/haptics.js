import * as Haptics from 'expo-haptics';

function run(fn) {
  fn().catch(() => {});
}

/** Light tap — tab switches, selections, secondary actions */
export function hapticLight() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Medium tap — primary buttons, add actions */
export function hapticMedium() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Selection tick — toggles, chips, humidor pick */
export function hapticSelection() {
  run(() => Haptics.selectionAsync());
}

/** Success — saved journal entry, favorited, cellaring started */
export function hapticSuccess() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Warning — destructive actions */
export function hapticWarning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

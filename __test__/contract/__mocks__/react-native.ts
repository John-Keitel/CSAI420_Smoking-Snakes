/**
 * Minimal stand-in for the `react-native` package, used only so
 * mobile/app/lib/stepRules.js's module-level `import { Platform } from
 * 'react-native'` resolves under Vitest without pulling in the real package
 * (which ships Flow syntax Vite's parser rejects). Aliased in via
 * vitest.config.mts's resolve.alias, not vi.mock — that operates at Vite's
 * resolution step, before the real file would otherwise be parsed.
 *
 * Only `Platform.OS` is referenced by the code paths this test suite exercises
 * (toUserData, splitName) — inputPropsForStep's DATE_KEYBOARD_TYPE branch is
 * not under test here, so an arbitrary fixed OS is fine.
 */
export const Platform = { OS: 'ios' };

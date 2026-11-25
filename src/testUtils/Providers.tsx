import MaskedView from '@react-native-masked-view/masked-view'
import { Provider as AutoPaperProvider, themeActions, type ThemeSettings } from '@rific/auto-paper'
import { FeedbackPressProvider, hapticActions, type HapticSettings, soundActions, type SoundSettings } from '@rific/feedback-press'
import { Toaster, ToastProvider } from '@rific/toaster'
import { PackProvider, ProfilesProvider, useProfiles } from '@tastic/shell'
import { type JSX, type ReactNode, useCallback } from 'react'
import * as RNPaper from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider as ReduxProvider, shallowEqual, useDispatch, useSelector } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

import { PackProviders, toastStackFrame } from '@/components/PackRoot'
import { smallTitleType } from '@/constants/typography'
import { pack } from '@/games/pack'
import { persistor, type RootState, store } from '@/redux/store'

const Feedback = ({ children }: { children: ReactNode }): JSX.Element => {
  const haptic = useSelector((state: RootState) => state.haptic, shallowEqual)
  const sound = useSelector((state: RootState) => state.sound, shallowEqual)
  const dispatch = useDispatch()
  const onChange = useCallback((next: HapticSettings) => dispatch(hapticActions.initialize(next)), [dispatch])
  const onSoundChange = useCallback((next: SoundSettings) => dispatch(soundActions.initialize(next)), [dispatch])
  return (
    <FeedbackPressProvider initialValue={haptic} onChange={onChange} soundInitialValue={sound} onSoundChange={onSoundChange} paper={RNPaper}>
      {children}
    </FeedbackPressProvider>
  )
}

const Theme = ({ children }: { children: ReactNode }): JSX.Element => {
  const settings = useSelector((state: RootState) => state.theme, shallowEqual)
  const dispatch = useDispatch()
  const onChange = useCallback((next: ThemeSettings) => dispatch(themeActions.initialize(next)), [dispatch])
  return (
    <AutoPaperProvider initialValue={settings} onChange={onChange} maskedView={MaskedView} statusBar={false}>
      {children}
    </AutoPaperProvider>
  )
}

// Everything below waits for the launch reconcile with the shared roster, as the shell's root does.
const Gate = ({ children }: { children: ReactNode }): JSX.Element | null => (useProfiles().loaded ? <>{children}</> : null)

// What @tastic/shell's RootLayout and the pack's Provider put around a screen, without the stack, for
// tests that render a screen on its own.
export const Providers = ({ children }: { children: ReactNode }): JSX.Element => (
  <SafeAreaProvider>
    <PackProvider pack={pack}>
      <ReduxProvider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <Feedback>
            <Theme>
              <ProfilesProvider>
                <PackProviders>
                  <Gate>
                    <ToastProvider paper={RNPaper}>
                      {children}
                      <Toaster position='top' wrapperStyle={toastStackFrame(375, { left: 0, right: 0 })} clearButton={null} historyButton={null} limit={1} labelStyle={smallTitleType} />
                    </ToastProvider>
                  </Gate>
                </PackProviders>
              </ProfilesProvider>
            </Theme>
          </Feedback>
        </PersistGate>
      </ReduxProvider>
    </PackProvider>
  </SafeAreaProvider>
)

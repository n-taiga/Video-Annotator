import { AppLayout } from './features/ui'
import { useAppController } from './app/useAppController'

export default function App() {
  const { appLayoutProps } = useAppController()
  return <AppLayout {...appLayoutProps} />
}

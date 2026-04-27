import { Link } from 'react-router-dom'
import { useGameResults } from '@/hooks/useGameResults'
import { useSessionConfig } from '@/hooks/useSessionConfig'
import GameCanvas from '@/components/GameCanvas'
import GameStatus from '@/components/GameStatus'
import GameResults from '@/components/GameResults'
import Logo from '@/images/logo.png'
import esportsFederationLogo from '@/images/esportsFederationLogo.png'
import { useGameEngine } from '@/utils/useGameEngine'
import { signOut, useSession } from '@/services/authClient'
import { useNavigate } from 'react-router-dom'

const GameScreen = () => {
  const { config, error: configError } = useSessionConfig()
  const { submitResults, isLoading, error: submitError } = useGameResults()
  const { data: session } = useSession()
  const navigate = useNavigate()

  const displayName =
    (session?.user as { username?: string })?.username || session?.user?.name

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (configError) {
    return (
      <div className="p-6 text-red-600">
        Ошибка загрузки настроек: {configError}
      </div>
    )
  }
  if (!config) {
    return <div className="p-6">Загрузка настроек...</div>
  }

  return (
    <GameScreenInner
      config={config}
      submitResults={submitResults}
      isLoading={isLoading}
      submitError={submitError}
      displayName={displayName}
      onSignOut={handleSignOut}
    />
  )
}

interface InnerProps {
  config: NonNullable<ReturnType<typeof useSessionConfig>['config']>
  submitResults: ReturnType<typeof useGameResults>['submitResults']
  isLoading: boolean
  submitError: string | null
  displayName?: string | null
  onSignOut: () => void
}

const GameScreenInner = ({
  config,
  submitResults,
  isLoading,
  submitError,
  displayName,
  onSignOut,
}: InnerProps) => {
  const engine = useGameEngine(config, submitResults)

  return (
    <div className="bg-gray-100 flex flex-col items-center p-4 max-h-screen h-full">
      <div className="rounded-lg w-full mx-auto flex flex-col gap-4 flex-1 max-h-screen h-full">
        <div className="bg-white p-4 rounded-lg shadow-lg w-full flex-shrink-0 grid grid-cols-[1fr_auto] items-center relative gap-4">
          {/* <div className="bg-white p-4 rounded-lg shadow-lg w-full flex-shrink-0 grid grid-cols-[155px_1fr_auto] items-center relative gap-4"> */}
          {/* <img className="w-[155px] object-contain" src={Logo} alt="Логотип" /> */}
          <h1 className="text-3xl font-bold text-center">
            Оценка техники наведения курсора на цель
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{displayName}</span>
            <Link
              to="/profile"
              className="bg-blue-600 text-white rounded px-3 py-1 text-sm font-semibold"
            >
              Профиль
            </Link>
            <button
              onClick={onSignOut}
              className="bg-gray-600 text-white rounded px-3 py-1 text-sm font-semibold"
            >
              Выход
            </button>
          </div>
        </div>

        <div className="flex gap-4 flex-row items-start justify-center flex-1 min-h-0 min-w-0">
          <GameCanvas
            canvasSize={engine.canvasSize}
            targetRadius={config.targetRadius}
            centerTolerance={config.centerTolerance}
            gameState={engine.gameState}
            currentRound={engine.currentRound}
            targetPosition={engine.targetPosition}
            mousePosition={engine.mousePosition}
            onMouseMove={engine.handleMouseMove}
            onMouseClick={engine.handleMouseClick}
            onTargetPainted={engine.handleTargetPainted}
            onStartGame={engine.startGame}
            containerRef={engine.containerRef}
          />
          <div className="flex flex-col max-w-[600px] gap-4 flex-1 min-w-0 min-h-0 overflow-y-auto h-full">
            <GameStatus
              gameState={engine.gameState}
              currentRound={engine.currentRound}
              roundsCount={config.roundsCount}
            />

            <GameResults
              gameState={engine.gameState}
              result={engine.result}
              isSubmitting={isLoading}
              error={submitError}
            />
          </div>
        </div>

        {/* <div className="w-full flex-shrink-0 h-[100px] flex items-center">
          <img className="h-full" src={esportsFederationLogo} alt="" />
          <p className="flex flex-col">
            <span>Сайт разработан при поддержке</span>
            <span>Федерации компьютерного спорта России</span>
          </p>
        </div> */}
      </div>
    </div>
  )
}

export default GameScreen

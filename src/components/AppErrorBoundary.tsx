import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * 遅延チャンクの読込失敗などで描画が例外を投げたとき、
 * 真っ白画面ではなく再読み込み導線を出す（インストール型 PWA には
 * ブラウザのリロードボタンがないため必須の逃げ道）
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen">
          <div className="card">
            <h1 className="app-title">定跡ツリー</h1>
            <p className="app-subtitle">画面の読み込みに失敗しました</p>
            <p>
              アプリの更新直後などに発生することがあります。再読み込みすると
              復旧します。
            </p>
            <button
              type="button"
              className="button-primary"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

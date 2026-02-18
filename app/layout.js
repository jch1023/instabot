import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata = {
  title: 'BLANKER BOT - Instagram DM Automation',
  description: '인스타그램 댓글 자동 DM 발송 서비스',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

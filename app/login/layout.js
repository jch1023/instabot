
import LoginBodyClass from './LoginBodyClass';

export const metadata = {
    title: '로그인 - BLANKER BOT',
};

export default function LoginLayout({ children }) {
    return (
        <div className="login-layout">
            <LoginBodyClass />
            {children}
        </div>
    );
}

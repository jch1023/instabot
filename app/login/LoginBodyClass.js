'use client';

import { useEffect } from 'react';

export default function LoginBodyClass() {
    useEffect(() => {
        document.body.classList.add('login-route');
        return () => {
            document.body.classList.remove('login-route');
        };
    }, []);

    return null;
}

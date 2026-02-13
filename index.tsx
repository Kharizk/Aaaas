
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<div style="color:red;padding:20px;">Fatal Error: Root element not found.</div>';
  throw new Error("Could not find root element to mount to");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} catch (error: any) {
    console.error("React Mount Failed:", error);
    rootElement.innerHTML = `
        <div style="display:flex; flex-direction:column; items-align:center; justify-content:center; height:100vh; text-align:center; color:#333; font-family:sans-serif;">
            <h2 style="color:#e11d48; margin-bottom:10px;">فشل تشغيل النظام</h2>
            <p>حدث خطأ غير متوقع أثناء بناء الواجهة.</p>
            <pre style="background:#f1f5f9; padding:15px; border-radius:8px; display:inline-block; text-align:left; direction:ltr; font-size:12px; color:#475569;">${error?.message || 'Unknown Error'}</pre>
            <button onclick="window.location.reload()" style="margin-top:20px; padding:10px 20px; background:#006C35; color:white; border:none; border-radius:6px; cursor:pointer;">إعادة المحاولة</button>
        </div>
    `;
}

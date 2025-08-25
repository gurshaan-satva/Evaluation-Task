// App.tsx
import React from 'react';
import { ConfigProvider } from 'antd';
import AppRouter from './routes/AppRouter';
import 'antd/dist/reset.css';

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
};

export default App;
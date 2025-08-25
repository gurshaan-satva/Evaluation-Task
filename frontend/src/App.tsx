// App.tsx
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import appRouter from './routes/AppRouter';
import 'antd/dist/reset.css';

const App: React.FC = () => {
  return (
  
      <RouterProvider router={appRouter} />

  );
};

export default App;
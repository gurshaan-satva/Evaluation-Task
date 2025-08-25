// pages/OAuthSuccess.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Result } from 'antd';
import { saveAuthData } from '../utils/auth';

const OAuthSuccess: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('qb_access_token');
      const realmId = urlParams.get('qb_realm_id');
      const connectionId = urlParams.get('qb_connection_id');
      const companyName = urlParams.get('qb_company_name');

      console.log('OAuth Success - URL Params:', {
        accessToken: accessToken ? 'present' : 'missing',
        realmId: realmId ? realmId : 'missing',
        connectionId: connectionId ? connectionId : 'missing',
        companyName: companyName ? decodeURIComponent(companyName) : 'missing'
      });

      if (accessToken && realmId && connectionId && companyName) {
        // Save auth data to localStorage
        const authData = {
          accessToken: decodeURIComponent(accessToken),
          realmId: decodeURIComponent(realmId),
          connectionId: decodeURIComponent(connectionId),
          companyName: decodeURIComponent(companyName)
        };

        console.log('Saving auth data:', authData);
        saveAuthData(authData);

        // Small delay to ensure localStorage is saved
        setTimeout(() => {
          console.log('Redirecting to dashboard...');
          navigate('/dashboard', { replace: true });
        }, 500);
      } else {
        console.error('Missing required OAuth parameters:', {
          accessToken: !!accessToken,
          realmId: !!realmId,
          connectionId: !!connectionId,
          companyName: !!companyName
        });
        
        // Redirect to landing page with error
        navigate('/?error=oauth_incomplete', { replace: true });
      }
    };

    handleOAuthSuccess();
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <Result
        icon={<Spin size="large" />}
        title="Completing QuickBooks Connection"
        subTitle="Please wait while we finalize your connection..."
      />
    </div>
  );
};

export default OAuthSuccess;
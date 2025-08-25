import { useState, useEffect } from 'react';
import { Button, Card, Row, Col, Typography, Space, Alert, Spin, message } from 'antd';
import { 
  FileTextOutlined, 
  DollarOutlined, 
  SyncOutlined, 
  CheckCircleOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DashboardOutlined,
  RightOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { getAuthUrl } from '../api/qboAuth';
import { isAuthenticated as checkIsAuthenticated, getCompanyName } from '../utils/auth';
import { useNavigate } from "react-router-dom";


const { Title, Paragraph, Text } = Typography;

type ConnectionStatus = 'connected' | 'error' | null;

const LandingPage = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);

  const navigate = useNavigate();

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkAuthStatus = () => {
      if (checkIsAuthenticated()) {
        setIsUserAuthenticated(true);
        setConnectionStatus('connected');
      }
    };

    checkAuthStatus();

    // Check for error parameters in URL (from backend redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) {
      let errorMessage = 'Authentication failed';
      switch (error) {
        case 'missing_code':
          errorMessage = 'Authorization code was not provided by QuickBooks';
          break;
        case 'missing_realm_id':
          errorMessage = 'Company ID was not provided by QuickBooks';
          break;
        case 'missing_state':
          errorMessage = 'Security validation failed';
          break;
        case 'callback_failed':
          errorMessage = 'Failed to establish QuickBooks connection';
          break;
        default:
          errorMessage = decodeURIComponent(error);
      }
      
      message.error(`Authentication failed: ${errorMessage}`);
      setConnectionStatus('error');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleOAuthCallback = async (code: string, state: string, realmId: string) => {
    // This method is no longer needed as backend handles the callback
    // and redirects directly to dashboard
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await getAuthUrl();
      
      if (response.data.status === 'success') {
        const { authUrl } = response.data.data;
        // Redirect to QuickBooks OAuth page
        window.location.href = authUrl;
      } else {
        message.error('Failed to generate QuickBooks authorization URL');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('Connection error:', error);
      message.error('Failed to initiate QuickBooks connection');
      setIsConnecting(false);
    }
  };

  const handleGoToDashboard = () => {
    // This would typically use React Router navigation
     navigate("/dashboard");
  };

  const handleViewDashboard = () => {
    // This would typically use React Router navigation
    navigate("/dashboard");
  };

  const features = [
    {
      icon: <SafetyOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: 'Secure OAuth 2.0 integration with QuickBooks',
    },
    {
      icon: <ClockCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: 'Real-time invoice and payment synchronization',
    },
    {
      icon: <BarChartOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: 'Detailed sync logs with status tracking',
    },
    {
      icon: <SyncOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: 'Bulk sync operations for efficiency',
    },
    {
      icon: <ReloadOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: 'Error handling and retry capabilities',
    },
    {
      icon: <DashboardOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: 'User-friendly dashboard interface',
    },
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '20px 0'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <Title level={1} style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            background: 'linear-gradient(45deg, #1890ff, #722ed1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            QuickSync <Text style={{ color: '#1890ff', fontSize : '48px' }}>AP</Text>
          </Title>
          <Paragraph style={{ 
            fontSize: '18px', 
            color: '#666',
            maxWidth: '600px',
            margin: '0 auto 40px',
            lineHeight: '1.6'
          }}>
            Streamline your accounts payable workflow with seamless QuickBooks integration
          </Paragraph>
          
          <Space size="large">
            {!isUserAuthenticated ? (
              <Button 
                type="primary" 
                size="large"
                onClick={handleConnect}
                loading={isConnecting}
                style={{
                  backgroundColor : '#1f851cff',
                  height: '50px',
                  padding: '0 30px',
                  fontSize: '16px',
                  borderRadius: '6px'
                }}
              >
                {isConnecting ? 'Connecting...' : 'Connect to QuickBooks'}
              </Button>
            ) : (
              <Button 
                type="primary" 
                size="large"
                icon={<DashboardOutlined />}
                onClick={handleGoToDashboard}
                style={{
                  height: '50px',
                  padding: '5px 30px',
                  fontSize: '16px',
                  borderRadius: '6px'
                }}
              >
                Go to Dashboard
              </Button>
            )}
            
            <Button 
              size="large"
              type='primary'
              onClick={handleViewDashboard}
              style={{
                height: '50px',
                padding: '0 30px',
                fontSize: '16px',
                borderRadius: '6px'
              }}
            >
              View Dashboard
            </Button>
          </Space>

          {isUserAuthenticated && (
            <Alert
              message="QuickBooks Connected Successfully"
              description={`Connected to ${getCompanyName()} - You can now sync your transactions`}
              type="success"
              showIcon
              style={{ marginTop: '20px', maxWidth: '500px', margin: '20px auto 0' }}
            />
          )}
        </div>

        {/* How It Works Section */}
        <div style={{ marginBottom: '80px' }}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: '20px' }}>
            How It Works
          </Title>
          <Paragraph style={{ 
            textAlign: 'center', 
            fontSize: '16px', 
            color: '#666',
            marginBottom: '60px'
          }}>
            Our platform makes it easy to keep your accounting data in sync with QuickBooks
          </Paragraph>

          <Row gutter={[32, 32]} justify="center">
            <Col xs={24} sm={24} md={8}>
              <Card
                style={{ 
                  textAlign: 'center',
                  height: '100%',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
                bodyStyle={{ padding: '40px 20px' }}
              >
                <FileTextOutlined style={{ 
                  fontSize: '48px', 
                  color: '#1890ff',
                  marginBottom: '20px'
                }} />
                <Title level={4} style={{ marginBottom: '16px' }}>
                  1. Connect QuickBooks
                </Title>
                <Paragraph style={{ color: '#666', lineHeight: '1.6' }}>
                  Securely link your QuickBooks Online account with our platform using OAuth 2.0 authentication
                </Paragraph>
              </Card>
            </Col>

            <Col xs={24} sm={24} md={8}>
              <Card
                style={{ 
                  textAlign: 'center',
                  height: '100%',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
                bodyStyle={{ padding: '40px 20px' }}
              >
                <DollarOutlined style={{ 
                  fontSize: '48px', 
                  color: '#52c41a',
                  marginBottom: '20px'
                }} />
                <Title level={4} style={{ marginBottom: '16px' }}>
                  2. Sync Transactions
                </Title>
                <Paragraph style={{ color: '#666', lineHeight: '1.6' }}>
                  Automatically or manually sync invoices and payments between your system and QuickBooks
                </Paragraph>
              </Card>
            </Col>

            <Col xs={24} sm={24} md={8}>
              <Card
                style={{ 
                  textAlign: 'center',
                  height: '100%',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
                bodyStyle={{ padding: '40px 20px' }}
              >
                <SyncOutlined style={{ 
                  fontSize: '48px', 
                  color: '#fa8c16',
                  marginBottom: '20px'
                }} />
                <Title level={4} style={{ marginBottom: '16px' }}>
                  3. Monitor Sync Status
                </Title>
                <Paragraph style={{ color: '#666', lineHeight: '1.6' }}>
                  Track all synchronization activities with a detailed sync log and real-time status updates
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </div>

        {/* Features Section */}
        {/* Features Section */}
<div style={{ 
  display: 'flex', 
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '60px 40px',
  borderRadius: '16px'
}}>
  {/* Left Section */}
  <div style={{ flex: '1', minWidth: '400px' , padding : "45px 40px",  minHeight: '400px',  backgroundColor: '#f8f9fa'}}>
    <h2 style={{ 
      marginBottom: '32px', 
      fontSize: '32px', 
      fontWeight: '700', 
      color: '#262626',
      margin: '0 0 32px 0'
    }}>
      Key Features
    </h2>
    
    <div style={{ marginBottom: '40px' }}>
      {features.map((feature, index) => (
        <div key={index} style={{ 
          display: 'flex', 
          alignItems: 'flex-start',
          marginBottom: '20px'
        }}>
          <CheckCircleOutlined style={{ 
            color: '#1890ff', 
            fontSize: '16px',
            marginRight: '12px',
            marginTop: '3px',
            flexShrink: 0
          }} />
          <span style={{ 
            fontSize: '16px', 
            lineHeight: '1.5',
            color: '#595959'
          }}>
            {feature.title}
          </span>
        </div>
      ))}
    </div>

    <Button 
      type="primary"
      size="large"
      onClick={!isUserAuthenticated ? handleConnect : handleGoToDashboard}
      loading={isConnecting}
      icon={<ArrowRightOutlined />}
      iconPosition="end"
      style={{
        height: '50px',
        padding: '0 30px',
        fontSize: '16px',
        borderRadius: '8px',
        fontWeight: '500',
        backgroundColor: '#1890ff',
        borderColor: '#1890ff'
      }}
    >
      Connect Your Account
    </Button>
  </div>

  {/* Right Section */}
  <div style={{ flex: '1', minWidth: '400px', minHeight: '400px', padding : "70px",  background: 'linear-gradient(135deg, #4A90E2 0%, #7B68EE 50%, #DA70D6 100%)' }}>
    <div style={{
      borderRadius: '16px',
      display : 'flex',
      flexDirection : 'column',
      justifyContent : 'center', alignItems: 'center',
      padding: '60px 40px',
      textAlign: 'center',
      color: 'white'
    }}>
      <h3 style={{ 
        color: 'white', 
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '600',
        lineHeight: '1.3',
        margin: '0 0 24px 0'
      }}>
        Ready to streamline your AP workflow?
      </h3>
      <p style={{ 
        color: 'rgba(255,255,255,0.9)', 
        fontSize: '16px',
        marginBottom: '32px',
        lineHeight: '1.6',
        fontWeight: '400',
        margin: '0 0 32px 0'
      }}>
        Connect your QuickBooks account and start syncing your transactions in minutes.
      </p>
      <Button 
        size="large"
        onClick={!isUserAuthenticated ? handleConnect : handleGoToDashboard}
        loading={isConnecting}
        icon={<ArrowRightOutlined />}
        iconPosition="end"
        style={{
          height: '50px',
          padding: '0 30px',
          fontSize: '16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderColor: 'rgba(255,255,255,0.25)',
          color: 'white',
          fontWeight: '500',
          border: '1px solid rgba(255,255,255,0.25)'
        }}
      >
        Go to Dashboard
      </Button>
    </div>
  </div>
</div>

        {/* Loading Spinner for Connection Process */}
        {isConnecting && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255,255,255,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{ textAlign: 'center' }}>
              <Spin size="large" />
              <div style={{ marginTop: '20px', fontSize: '16px', color: '#666' }}>
                Connecting to QuickBooks...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
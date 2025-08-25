import { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Typography,  
  Button, 
  Tag, 
  Tabs,
  Space,
  message,
  Spin,
  Modal
} from 'antd';
import { 
  FileTextOutlined, 
  DollarOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  DisconnectOutlined
} from '@ant-design/icons';
import { getCompanyName, getRealmId, saveAuthData, clearAuthData, getConnectionId } from '../utils/auth';
import { getInvoiceSyncStatistics, syncAllInvoices } from '../api/qboInvoices';
import { getPaymentSyncStatus, syncAllPayments } from '../api/qboPayment';
import { disconnectQBO } from '../api/qboAuth';
import InvoiceTable from '../components/InvoiceTable';
import PaymentTable from '../components/PaymentTable';
import { useNavigate } from "react-router-dom";


const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { confirm } = Modal;



interface DashboardStats {
  invoices: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
    syncedPercentage: string;
  };
  payments: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
    syncedPercentage: string;
  };
  syncAttempts: {
    total: number;
    successful: number;
    failed: number;
    successRate: string;
  };
  lastSyncAt: string | null;
}

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingInvoices, setSyncingInvoices] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState('invoices');

  // Check if any sync operation is running for full-page loader
  const isAnySyncRunning = syncingInvoices || syncingPayments;

    const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a redirect from successful OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const company = urlParams.get('company');
    const realmId = urlParams.get('realm_id');
    const connectionId = urlParams.get('connection_id');

    if (connected === 'true' && company && realmId && connectionId) {
      // Save the auth data from the redirect
      saveAuthData({
        accessToken: 'authenticated',
        realmId: realmId,
        connectionId: connectionId,
        companyName: decodeURIComponent(company)
      });

      // Show success message
      message.success(`Successfully connected to QuickBooks: ${decodeURIComponent(company)}`);
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/dashboard');
    }

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch both invoice and payment statistics
      const [invoiceResponse, paymentResponse] = await Promise.allSettled([
        getInvoiceSyncStatistics(),
        getPaymentSyncStatus()
      ]);
      
      // Process invoice data
      let invoiceData = {
        total: 0,
        synced: 0,
        pending: 0,
        failed: 0,
        syncedPercentage: '0'
      };
      
      if (invoiceResponse.status === 'fulfilled' && invoiceResponse.value.data.status === 'success') {
        const data = invoiceResponse.value.data.data;
        invoiceData = {
          total: data.summary?.totalInvoices || 0,
          synced: data.summary?.syncedInvoices || 0,
          pending: data.summary?.pendingInvoices || 0,
          failed: data.summary?.failedInvoices || 0,
          syncedPercentage: data.summary?.totalInvoices > 0 
            ? Math.round((data.summary.syncedInvoices / data.summary.totalInvoices) * 100).toString() 
            : '0'
        };
      }
      
      // Process payment data
      let paymentData = {
        total: 0,
        synced: 0,
        pending: 0,
        failed: 0,
        syncedPercentage: '0'
      };
      
      if (paymentResponse.status === 'fulfilled' && paymentResponse.value.data.status === 'success') {
        const data = paymentResponse.value.data.data;
        paymentData = {
          total: data.summary?.totalPayments || 0,
          synced: data.summary?.syncedPayments || 0,
          pending: data.summary?.pendingPayments || 0,
          failed: data.summary?.failedPayments || 0,
          syncedPercentage: data.summary?.totalPayments > 0 
            ? Math.round((data.summary.syncedPayments / data.summary.totalPayments) * 100).toString() 
            : '0'
        };
      }
      
      // Calculate combined sync attempts data
      const totalSyncAttempts = invoiceData.total + paymentData.total;
      const successfulSyncAttempts = invoiceData.synced + paymentData.synced;
      const failedSyncAttempts = invoiceData.failed + paymentData.failed;
      const successRate = totalSyncAttempts > 0 ? Math.round((successfulSyncAttempts / totalSyncAttempts) * 100) : 0;

      setStats({
        invoices: invoiceData,
        payments: paymentData,
        syncAttempts: {
          total: totalSyncAttempts,
          successful: successfulSyncAttempts,
          failed: failedSyncAttempts,
          successRate: `${successRate}%`
        },
        lastSyncAt: null // You can get this from either API response if available
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      message.error('Failed to load dashboard data');
      
      // Use mock data as fallback
      setStats({
        invoices: {
          total: 13,
          synced: 4,
          pending: 9,
          failed: 0,
          syncedPercentage: '31'
        },
        payments: {
          total: 8,
          synced: 3,
          pending: 4,
          failed: 1,
          syncedPercentage: '38'
        },
        syncAttempts: {
          total: 21,
          successful: 7,
          failed: 1,
          successRate: '33%'
        },
        lastSyncAt: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAllInvoices = async () => {
    setSyncingInvoices(true);
    try {
      const response = await syncAllInvoices();

      if (response.data.status === 'success') {
        message.success(`Successfully initiated sync for ${response.data.data?.totalInvoices || 'all'} invoices`);
        // Refresh dashboard data
        await fetchDashboardData();
      } else {
        throw new Error(response.data.message || 'Failed to sync invoices');
      }
    } catch (error) {
      console.error('Error syncing invoices:', error);
      message.error(`Failed to sync invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncingInvoices(false);
    }
  };

  const handleSyncAllPayments = async () => {
    setSyncingPayments(true);
    try {
      const response = await syncAllPayments();

      if (response.data.status === 'success') {
        message.success(`Successfully initiated sync for ${response.data.data?.totalPayments || 'all'} payments`);
        // Refresh dashboard data
        await fetchDashboardData();
      } else {
        throw new Error(response.data.message || 'Failed to sync payments');
      }
    } catch (error) {
      console.error('Error syncing payments:', error);
      message.error(`Failed to sync payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncingPayments(false);
    }
  };

  // const handleSyncAllUnsynchronized = async () => {
  //   const hasPendingInvoices = (stats?.invoices.pending || 0) > 0 || (stats?.invoices.failed || 0) > 0;
  //   const hasPendingPayments = (stats?.payments.pending || 0) > 0 || (stats?.payments.failed || 0) > 0;

  //   if (!hasPendingInvoices && !hasPendingPayments) {
  //     message.info('No unsynchronized records found');
  //     return;
  //   }

  //   try {
  //     const promises = [];
      
  //     if (hasPendingInvoices) {
  //       setSyncingInvoices(true);
  //       promises.push(syncAllInvoices());
  //     }
      
  //     if (hasPendingPayments) {
  //       setSyncingPayments(true);
  //       promises.push(syncAllPayments());
  //     }

  //     // Wait for all sync operations to complete
  //     const responses = await Promise.allSettled(promises);
      
  //     // Check results and show appropriate messages
  //     let successCount = 0;
  //     let failureCount = 0;
      
  //     responses.forEach((result, index) => {
  //       if (result.status === 'fulfilled') {
  //         if (result.value.data.status === 'success') {
  //           successCount++;
  //         } else {
  //           failureCount++;
  //         }
  //       } else {
  //         failureCount++;
  //       }
  //     });
      
  //     if (successCount > 0 && failureCount === 0) {
  //       message.success('Successfully initiated sync for all unsynchronized records');
  //     } else if (successCount > 0 && failureCount > 0) {
  //       message.warning('Some sync operations completed successfully, others failed');
  //     } else {
  //       message.error('Failed to initiate sync operations');
  //     }
      
  //     // Refresh dashboard data
  //     await fetchDashboardData();
  //   } catch (error) {
  //     console.error('Error in bulk sync:', error);
  //     message.error('Failed to initiate bulk sync');
  //   } finally {
  //     setSyncingInvoices(false);
  //     setSyncingPayments(false);
  //   }
  // };

  const handleViewSyncLog = () => {
    // Navigate to sync log page
    navigate("/sync-logs");
  };

  const handleDisconnect = () => {
    const companyName = getCompanyName();
    const connectionId = getConnectionId();

    if (!connectionId) {
      message.error('No active connection found to disconnect');
      return;
    }

    confirm({
      title: 'Disconnect from QuickBooks?',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div style={{ marginTop: '16px' }}>
          <p style={{ marginBottom: '12px' }}>
            Are you sure you want to disconnect from <strong>{companyName}</strong>?
          </p>
        </div>
      ),
      okText: 'Yes, Disconnect',
      okType: 'danger',
      cancelText: 'Cancel',
      width: 480,
      onOk: async () => {
        setDisconnecting(true);
        try {
          // Call the disconnect API
          await disconnectQBO(connectionId);
          
          // Clear localStorage
          clearAuthData();
          
          // Show success message
          message.success('Successfully disconnected from QuickBooks');
          
          // Redirect to base route after a short delay
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
          
        } catch (error) {
          console.error('Error disconnecting from QuickBooks:', error);
          
          // Check if it's a network error or API error
          if (
            typeof error === 'object' &&
            error !== null &&
            'response' in error
          ) {
            const err = error as { response?: { data?: { message?: string } } };
            const errorMessage = err.response?.data?.message || 'Failed to disconnect from QuickBooks';
            message.error(errorMessage);
          } else if (
            typeof error === 'object' &&
            error !== null &&
            'request' in error
          ) {
            message.error('Network error: Unable to reach QuickBooks servers');
          } else {
            message.error('An unexpected error occurred while disconnecting');
          }
          
          setDisconnecting(false);
        }
      },
      onCancel: () => {
        // User cancelled, do nothing
      }
    });
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {/* Full-page loader for sync operations */}
      {isAnySyncRunning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(2px)'
        }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Text style={{ fontSize: '16px', fontWeight: 500 }}>
              {syncingInvoices && syncingPayments 
                ? 'Syncing invoices and payments...' 
                : syncingInvoices 
                ? 'Syncing invoices...' 
                : 'Syncing payments...'
              }
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Please wait while we synchronize your data with QuickBooks
            </Text>
          </div>
        </div>
      )}

      <div style={{ 
        minHeight: '100vh', 
        background: '#f5f5f5',
        padding: '24px'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <Title level={2} style={{ marginBottom: '8px' }}>
              QuickBooks Sync Dashboard
            </Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              Manage your invoice and payment synchronization with QuickBooks
            </Text>
          </div>

          {/* Stats Cards */}
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            {/* Invoices Card */}
            <Col xs={24} sm={12} lg={6}>
              <Card 
                style={{ height: '100%' }}
                bodyStyle={{ padding: '24px' }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary" style={{ fontSize: '14px' }}>Invoices</Text>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <Title level={1} style={{ margin: 0, fontSize: '48px', fontWeight: 600 }}>
                    {stats?.invoices.total || 0}
                  </Title>
                </div>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Synced:</Text>
                    <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                      {stats?.invoices.synced || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Pending:</Text>
                    <Text style={{ color: '#faad14', fontWeight: 500 }}>
                      {stats?.invoices.pending || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Failed:</Text>
                    <Text style={{ color: '#ff4d4f', fontWeight: 500 }}>
                      {stats?.invoices.failed || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Sync Rate:</Text>
                    <Text style={{ 
                      color: parseInt(stats?.invoices.syncedPercentage || '0') > 80 ? '#52c41a' : 
                             parseInt(stats?.invoices.syncedPercentage || '0') > 50 ? '#faad14' : '#ff4d4f',
                      fontWeight: 500 
                    }}>
                      {stats?.invoices.syncedPercentage || 0}%
                    </Text>
                  </div>
                </Space>
                <Button 
                  type="primary" 
                  ghost 
                  icon={<SyncOutlined />}
                  style={{ marginTop: '16px', width: '100%' }}
                  onClick={handleSyncAllInvoices}
                  loading={syncingInvoices}
                  disabled={(!stats?.invoices.pending && !stats?.invoices.failed) || isAnySyncRunning}
                >
                  {syncingInvoices ? 'Syncing...' : 'Sync All Invoices'}
                </Button>
              </Card>
            </Col>

            {/* Payments Card */}
            <Col xs={24} sm={12} lg={6}>
              <Card 
                style={{ height: '100%' }}
                bodyStyle={{ padding: '24px' }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary" style={{ fontSize: '14px' }}>Payments</Text>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <Title level={1} style={{ margin: 0, fontSize: '48px', fontWeight: 600 }}>
                    {stats?.payments.total || 0}
                  </Title>
                </div>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Synced:</Text>
                    <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                      {stats?.payments.synced || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Pending:</Text>
                    <Text style={{ color: '#faad14', fontWeight: 500 }}>
                      {stats?.payments.pending || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Failed:</Text>
                    <Text style={{ color: '#ff4d4f', fontWeight: 500 }}>
                      {stats?.payments.failed || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Sync Rate:</Text>
                    <Text style={{ 
                      color: parseInt(stats?.payments.syncedPercentage || '0') > 80 ? '#52c41a' : 
                             parseInt(stats?.payments.syncedPercentage || '0') > 50 ? '#faad14' : '#ff4d4f',
                      fontWeight: 500 
                    }}>
                      {stats?.payments.syncedPercentage || 0}%
                    </Text>
                  </div>
                </Space>
                <Button 
                  type="primary" 
                  ghost 
                  icon={<SyncOutlined />}
                  style={{ marginTop: '16px', width: '100%' }}
                  onClick={handleSyncAllPayments}
                  loading={syncingPayments}
                  disabled={(!stats?.payments.pending && !stats?.payments.failed) || isAnySyncRunning}
                >
                  {syncingPayments ? 'Syncing...' : 'Sync All Payments'}
                </Button>
              </Card>
            </Col>

            {/* Total Records Card */}
            <Col xs={24} sm={12} lg={6}>
              <Card 
                style={{ height: '100%' }}
                bodyStyle={{ padding: '24px' }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary" style={{ fontSize: '14px' }}>Total Records</Text>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <Title level={1} style={{ margin: 0, fontSize: '48px', fontWeight: 600 }}>
                    {(stats?.invoices.total || 0) + (stats?.payments.total || 0)}
                  </Title>
                </div>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <FileTextOutlined style={{ color: '#1890ff' }} />
                      <Text>Invoices</Text>
                    </Space>
                    <Text style={{ fontWeight: 500 }}>
                      {stats?.invoices.total || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <DollarOutlined style={{ color: '#52c41a' }} />
                      <Text>Payments</Text>
                    </Space>
                    <Text style={{ fontWeight: 500 }}>
                      {stats?.payments.total || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom : "30px"}}>
                    <Space>
                      <SyncOutlined style={{ color: '#faad14' }} />
                      <Text>Success Rate</Text>
                    </Space>
                    <Text style={{ fontWeight: 500 }}>
                      {stats?.syncAttempts.successRate || '0%'}
                    </Text>
                  </div>
                </Space>
                <Button 
                  type="default" 
                  style={{ marginTop: '16px', width: '100%' }}
                  onClick={handleViewSyncLog}
                  disabled={isAnySyncRunning}
                >
                  View Sync Log
                </Button>
              </Card>
            </Col>

            {/* QuickBooks Status Card */}
            <Col xs={24} sm={12} lg={6}>
              <Card 
                style={{ height: '100%' }}
                bodyStyle={{ padding: '24px' }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary" style={{ fontSize: '14px' }}>QuickBooks Status</Text>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <Tag 
                    icon={<CheckCircleOutlined />}
                    color="success" 
                    style={{ fontSize: '14px', padding: '4px 12px' }}
                  >
                    Connected
                  </Tag>
                </div>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">Company ID:</Text>
                    <br />
                    <Text style={{ fontWeight: 500, fontSize: '12px', fontFamily: 'monospace' }}>
                      {getRealmId()?.slice(0, 10)}...
                    </Text>
                  </div>
                  <div style={{ marginBottom: '40px' }}>
                    <Text type="secondary">Company:</Text>
                    <br />
                    <Text style={{ fontWeight: 500 }}>
                      {getCompanyName()}
                    </Text>
                  </div>
                </Space>
                <Space direction="vertical" style={{ width: '100%', marginTop: '16px' }}>
                  <Button 
                    danger
                    icon={<DisconnectOutlined />}
                    style={{ width: '100%' }}
                    onClick={handleDisconnect}
                    loading={disconnecting}
                    disabled={isAnySyncRunning}
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Tables Section */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Button 
                  type="link" 
                  icon={<FileTextOutlined />}
                  style={{ 
                    padding: 0, 
                    color: activeTab === 'invoices' ? '#1890ff' : '#8c8c8c',
                    fontWeight: activeTab === 'invoices' ? 500 : 400
                  }}
                  onClick={() => setActiveTab('invoices')}
                  disabled={isAnySyncRunning}
                >
                  Invoices
                </Button>
                <Button 
                  type="link" 
                  icon={<DollarOutlined />}
                  style={{ 
                    padding: 0, 
                    marginLeft: '24px',
                    color: activeTab === 'payments' ? '#1890ff' : '#8c8c8c',
                    fontWeight: activeTab === 'payments' ? 500 : 400
                  }}
                  onClick={() => setActiveTab('payments')}
                  disabled={isAnySyncRunning}
                >
                  Payments
                </Button>
              </div>
            </div>

            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              style={{ marginTop: '-16px' }}
              tabBarStyle={{ display: 'none' }}
            >
              <TabPane tab="Invoices" key="invoices">
                <InvoiceTable />
              </TabPane>
              <TabPane tab="Payments" key="payments">
                <PaymentTable />
              </TabPane>
            </Tabs>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
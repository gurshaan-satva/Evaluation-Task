import { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  message,
  Input,
  Select,
  DatePicker,
  Card,
  Badge,
  Row,
  Col
} from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  SyncOutlined,
  DollarOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons';

import { getAllPayments, syncSinglePayment, syncAllPayments } from '../api/qboPayment';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Payment {
  id: string;
  paymentNumber: string;
  qboPaymentId?: string;
  amount: number;
  status: string;
  syncStatus: string;
  lastSyncedAt?: string;
  customer: {
    id: string;
    displayName: string;
    email?: string;
  };
  paymentMethod: string;
  paymentDate: string;
  createdAt: string;
  isSynced: boolean;
}

interface PaymentTableProps {
  onSyncAll?: () => void;
}

const PaymentTable: React.FC<PaymentTableProps> = ({ onSyncAll }) => {
  const [pageLoading, setPageLoading] = useState(false);
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [syncStatusFilter, setSyncStatusFilter] = useState<string | undefined>(undefined);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  // Sorting states
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Debounce timer for search
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear the previous timer
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    // Set a new timer for debounced search
    const timer = setTimeout(() => {
      fetchPayments();
    }, searchText ? 500 : 0);

    setSearchTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    pagination.current,
    pagination.pageSize,
    searchText,
    statusFilter,
    syncStatusFilter,
    paymentMethodFilter,
    dateRange,
    sortBy,
    sortOrder
  ]);

  const fetchPayments = async () => {
    try {
      setPageLoading(true);
      
      const params: any = {
        page: pagination.current,
        limit: pagination.pageSize,
        sortBy,
        sortOrder
      };

      // Add filters only if they have values
      if (searchText?.trim()) {
        params.search = searchText.trim();
      }
      
      if (statusFilter) {
        params.status = statusFilter;
      }
      
      if (syncStatusFilter) {
        params.syncStatus = syncStatusFilter;
      }
      
      if (paymentMethodFilter) {
        params.paymentMethod = paymentMethodFilter;
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].startOf('day').toISOString();
        params.dateTo = dateRange[1].endOf('day').toISOString();
      }

      console.log('API params:', params); // Debug log

      const response = await getAllPayments(params);

      if (response.data.status === 'success') {
        setPayments(response.data.data.payments);
        setPagination(prev => ({
          ...prev,
          total: response.data.data.totalCount || response.data.data.pagination?.totalCount,
        }));
      } else {
        throw new Error('Failed to fetch payments');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      // Use mock data for demo
      setPayments([
        {
          id: 'pay-001',
          paymentNumber: 'PAY-001',
          qboPaymentId: 'QB-PAY-98765',
          amount: 2500.00,
          status: 'Completed',
          syncStatus: 'SUCCESS',
          lastSyncedAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          customer: {
            id: 'cust-001',
            displayName: 'Acme Corporation',
            email: 'billing@acme.com'
          },
          paymentMethod: 'Bank Transfer',
          paymentDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isSynced: true
        },
        {
          id: 'pay-002',
          paymentNumber: 'PAY-002',
          amount: 1875.50,
          status: 'Pending',
          syncStatus: 'FAILED',
          customer: {
            id: 'cust-002',
            displayName: 'Globex Industries',
            email: 'ap@globex.com'
          },
          paymentMethod: 'Credit Card',
          paymentDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isSynced: false
        },
        {
          id: 'pay-003',
          paymentNumber: 'PAY-003',
          qboPaymentId: 'QB-PAY-11223',
          amount: 4200.00,
          status: 'Completed',
          syncStatus: 'SUCCESS',
          lastSyncedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          customer: {
            id: 'cust-003',
            displayName: 'Sterling Cooper',
            email: 'billing@sterling.com'
          },
          paymentMethod: 'Check',
          paymentDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isSynced: true
        },
        {
          id: 'pay-004',
          paymentNumber: 'PAY-004',
          amount: 1200.00,
          status: 'Pending',
          syncStatus: 'PENDING',
          customer: {
            id: 'cust-001',
            displayName: 'Acme Corporation',
            email: 'billing@acme.com'
          },
          paymentMethod: 'Bank Transfer',
          paymentDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isSynced: false
        }
      ]);
      setPagination(prev => ({ ...prev, total: 4 }));
    } finally {
      setPageLoading(false);
    }
  };

  const handleSyncPayment = async (paymentId: string) => {
    try {
      setSyncingPaymentId(paymentId);
      const response = await syncSinglePayment(paymentId);

      if (response.data.status === 'success') {
        message.success('Payment synced successfully');
        fetchPayments();
      } else {
        message.error('Failed to sync payment');
      }
    } catch (error) {
      console.error('Error syncing payment:', error);
      message.error('Failed to sync payment');
    } finally {
      setSyncingPaymentId(null);
    }
  };

  const handleSyncAllUnsynchronized = async () => {
    try {
      setPageLoading(true);
      const response = await syncAllPayments();

      if (response.data.status === 'success') {
        message.success('All unsynchronized payments synced successfully');
        fetchPayments();
        onSyncAll?.();
      } else {
        message.error('Failed to sync all payments');
      }
    } catch (error) {
      console.error('Error syncing all payments:', error);
      message.error('Failed to sync all payments');
    } finally {
      setPageLoading(false);
    }
  };

  const resetAllFilters = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setSyncStatusFilter(undefined);
    setPaymentMethodFilter(undefined);
    setDateRange(null);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (paginationConfig: any, filters: any, sorter: any) => {
    setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
      total: pagination.total,
    });

    // Update sorting if provided
    if (sorter.field && sorter.order) {
      setSortBy(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    setSearchText(value);
    // Reset to first page when searching
    if (pagination.current !== 1) {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  };

  const handleFilterChange = (filterName: string, value: any) => {
    switch (filterName) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'syncStatus':
        setSyncStatusFilter(value);
        break;
      case 'paymentMethod':
        setPaymentMethodFilter(value);
        break;
      case 'dateRange':
        setDateRange(value);
        break;
    }

    // Reset to first page when applying filters
    if (pagination.current !== 1) {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'green';
      case 'pending': return 'orange';
      case 'failed': return 'red';
      case 'cancelled': return 'red';
      default: return 'default';
    }
  };

  const getSyncStatusIcon = (syncStatus: string, isSynced: boolean) => {
    if (isSynced && syncStatus === 'SUCCESS') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    } else if (syncStatus === 'FAILED') {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    } else {
      return <SyncOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getSyncStatusText = (payment: Payment) => {
    if (payment.isSynced && payment.syncStatus === 'SUCCESS') {
      const timeAgo = payment.lastSyncedAt 
        ? getTimeAgo(new Date(payment.lastSyncedAt))
        : 'Unknown time';
      return (
        <div>
          <div style={{ color: '#52c41a', fontWeight: 500 }}>Success</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{timeAgo}</div>
        </div>
      );
    } else if (payment.syncStatus === 'FAILED') {
      return (
        <div>
          <div style={{ color: '#ff4d4f', fontWeight: 500 }}>Failed</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
            Failed to sync Payment to QuickBooks
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <div style={{ color: '#faad14', fontWeight: 500 }}>Pending</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Waiting to sync</div>
        </div>
      );
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'less than a minute ago';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const columns = [
    {
      title: 'PAYMENT',
      key: 'id',
      dataIndex: 'id',
    
      render: (paymentNumber: string) => (
        <Space direction="vertical" size={0}>
          <Space>
            <DollarOutlined style={{ color: '#52c41a' }} />
            <Text strong>{paymentNumber}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'QBO PAYMENT ID',
      dataIndex: 'qboPaymentId',
      key: 'qboPaymentId',
      render: (qboPaymentId: string | null) => (
        <Text>{qboPaymentId ?? '-'}</Text>
      ),
    },
    {
      title: 'AMOUNT',
      key: 'amount',
      dataIndex: 'amount',
      render: (amount: number) => (
        <Text strong>${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
      ),
    },
    {
      title: 'METHOD',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => <Text>{method}</Text>,
    },
    {
      title: 'STATUS',
      key: 'status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'SYNC STATUS',
      key: 'syncStatus',
      render: (record: Payment) => (
        <Space>
          {getSyncStatusIcon(record.syncStatus, record.isSynced)}
          {getSyncStatusText(record)}
        </Space>
      ),
    },
    {
      title: 'ACTION',
      key: 'action',
      render: (record: Payment) => (
        <Space>
          {record.isSynced ? (
            <Text type="secondary">Synced</Text>
          ) : (
            <Button 
              type="link" 
              size="small"
              style={{ color: '#1890ff', padding: 0 }}
              onClick={() => handleSyncPayment(record.id)}
              loading={syncingPaymentId === record.id}
              disabled={pageLoading || syncingPaymentId !== null}
            >
              Sync Now
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Get count of unsynchronized payments
  const unsynchronizedCount = payments.filter(payment => !payment.isSynced).length;
  const hasActiveFilters = searchText || statusFilter || syncStatusFilter || 
    paymentMethodFilter || dateRange;

  return (
    <div>
      {/* Filters Card */}
      <Card
        size="small"
        style={{ marginBottom: '16px' }}
        title={
          <Space>
            <FilterOutlined />
            <Text>Filters</Text>
            {hasActiveFilters && <Badge dot />}
          </Space>
        }
        extra={
          <Button
            size="small"
            onClick={resetAllFilters}
            icon={<ClearOutlined />}
            disabled={!hasActiveFilters}
          >
            Reset
          </Button>
        }
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search payments..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={handleSearchChange}
              allowClear
            />
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="All Statuses"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
            >
              <Option value="COMPLETED">Completed</Option>
              <Option value="PENDING">Pending</Option>
              <Option value="FAILED">Failed</Option>
              <Option value="CANCELLED">Cancelled</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Sync Status"
              style={{ width: '100%' }}
              value={syncStatusFilter}
              onChange={(value) => handleFilterChange('syncStatus', value)}
              allowClear
            >
              <Option value="PENDING">Pending</Option>
              <Option value="SUCCESS">Success</Option>
              <Option value="FAILED">Failed</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Payment Method"
              style={{ width: '100%' }}
              value={paymentMethodFilter}
              onChange={(value) => handleFilterChange('paymentMethod', value)}
              allowClear
            >
              <Option value="BANK_TRANSFER">Bank Transfer</Option>
              <Option value="CREDIT_CARD">Credit Card</Option>
              <Option value="CHECK">Check</Option>
              <Option value="CASH">Cash</Option>
            </Select>
          </Col>
        </Row>

        <Row gutter={[16, 8]} style={{ marginTop: '8px' }}>
          
          
          
          <Col xs={24} sm={12} md={6}>
            <Text style={{ fontSize: '12px', color: '#8c8c8c', lineHeight: '32px' }}>
              {payments.length} of {pagination.total} payments
              {hasActiveFilters && ' (filtered)'}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Sync All Button - only show if there are unsynchronized payments */}
      {unsynchronizedCount > 0 && (
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <Button
            type="primary"
            ghost
            icon={<SyncOutlined />}
            onClick={handleSyncAllUnsynchronized}
            loading={pageLoading}
            disabled={syncingPaymentId !== null}
          >
            Sync All Unsynchronized ({unsynchronizedCount})
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={payments}
        rowKey="id"
        loading={pageLoading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} payments`,
        }}
        onChange={handleTableChange}
        size="middle"
      />
    </div>
  );
};

export default PaymentTable;
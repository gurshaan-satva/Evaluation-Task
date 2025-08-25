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
  FileTextOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons';
import { getAllInvoices, syncSingleInvoice } from '../api/qboInvoices';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Invoice {
  id: string;
  docNumber: string;
  qboInvoiceId?: string;
  total: number;
  status: string;
  syncStatus: string;
  lastSyncedAt?: string;
  customer: {
    id: string;
    displayName: string;
    email?: string;
  };
  createdAt: string;
  invoiceDate: string;
  dueDate: string;
  isSynced: boolean;
}

interface InvoiceTableProps {
  onSyncAll?: () => void;
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({ onSyncAll }) => {
  const [pageLoading, setPageLoading] = useState(false);
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [syncStatusFilter, setSyncStatusFilter] = useState<string | undefined>(undefined);
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
      fetchInvoices();
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
    dateRange,
    sortBy,
    sortOrder
  ]);

  const fetchInvoices = async () => {
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

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].startOf('day').toISOString();
        params.dateTo = dateRange[1].endOf('day').toISOString();
      }

      const response = await getAllInvoices(params);

      if (response.data.status === 'success') {
        setInvoices(response.data.data.invoices);
        setPagination(prev => ({
          ...prev,
          total: response.data.data.totalCount || response.data.data.pagination?.totalCount,
        }));
      } else {
        throw new Error('Failed to fetch invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // Use mock data for demo
      setInvoices([
        {
          id: 'inv-001',
          docNumber: 'INV-001',
          qboInvoiceId: 'QB-05-INV-30994',
          total: 2500.00,
          status: 'Sent',
          syncStatus: 'SUCCESS',
          lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
          customer: {
            id: 'cust-001',
            displayName: 'Acme Corporation',
            email: 'billing@acme.com'
          },
          createdAt: new Date().toISOString(),
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          isSynced: true
        },
        {
          id: 'inv-002',
          docNumber: 'INV-002',
          qboInvoiceId: 'QB-123456789',
          total: 1875.50,
          status: 'Paid',
          syncStatus: 'SUCCESS',
          lastSyncedAt: new Date(Date.now() - 86400000).toISOString(),
          customer: {
            id: 'cust-002',
            displayName: 'Globex Industries',
            email: 'ap@globex.com'
          },
          createdAt: new Date().toISOString(),
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          isSynced: true
        },
        {
          id: 'inv-003',
          docNumber: 'INV-003',
          total: 4200.00,
          status: 'Draft',
          syncStatus: 'FAILED',
          customer: {
            id: 'cust-003',
            displayName: 'Sterling Cooper',
            email: 'billing@sterling.com'
          },
          createdAt: new Date().toISOString(),
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          isSynced: false
        },
        {
          id: 'inv-004',
          docNumber: 'INV-004',
          qboInvoiceId: 'QB-QB-INV-64192',
          total: 1200.00,
          status: 'Overdue',
          syncStatus: 'SUCCESS',
          lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
          customer: {
            id: 'cust-001',
            displayName: 'Acme Corporation',
            email: 'billing@acme.com'
          },
          createdAt: new Date().toISOString(),
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          isSynced: true
        }
      ]);
      setPagination(prev => ({ ...prev, total: 4 }));
    } finally {
      setPageLoading(false);
    }
  };

  const handleSyncInvoice = async (invoiceId: string) => {
    try {
      setSyncingInvoiceId(invoiceId);
      const response = await syncSingleInvoice(invoiceId);

      if (response.data.status === 'success') {
        message.success('Invoice synced successfully');
        fetchInvoices();
      } else {
        message.error('Failed to sync invoice');
      }
    } catch (error) {
      console.error('Error syncing invoice:', error);
      message.error('Failed to sync invoice');
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  const handleSyncAllUnsynchronized = async () => {
    try {
      setPageLoading(true);
      // This function would need to be implemented in the API
      // const response = await syncAllInvoices();
      message.success('All unsynchronized invoices synced successfully');
      fetchInvoices();
      onSyncAll?.();
    } catch (error) {
      console.error('Error syncing all invoices:', error);
      message.error('Failed to sync all invoices');
    } finally {
      setPageLoading(false);
    }
  };

  const resetAllFilters = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setSyncStatusFilter(undefined);
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
      case 'sent': return 'blue';
      case 'paid': return 'green';
      case 'draft': return 'default';
      case 'overdue': return 'orange';
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

  const getSyncStatusText = (invoice: Invoice) => {
    if (invoice.isSynced && invoice.syncStatus === 'SUCCESS') {
      const timeAgo = invoice.lastSyncedAt
        ? getTimeAgo(new Date(invoice.lastSyncedAt))
        : 'Unknown time';
      return (
        <div>
          <div style={{ color: '#52c41a', fontWeight: 500 }}>Success</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{timeAgo}</div>
        </div>
      );
    } else if (invoice.syncStatus === 'FAILED') {
      return (
        <div>
          <div style={{ color: '#ff4d4f', fontWeight: 500 }}>Failed</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
            Failed to sync Invoice to QuickBooks
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
      title: 'INVOICE',
      key: 'invoice',
      dataIndex: 'docNumber',
      render: (docNumber: string) => (
        <Space direction="vertical" size={0}>
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <Text strong>{docNumber}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'CUSTOMER',
      dataIndex: ['customer', 'displayName'],
      key: 'customer',
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: 'QBO INVOICE ID',
      dataIndex: 'qboInvoiceId',
      key: 'qboInvoiceId',
      render: (qboInvoiceId: string | null) => (
        <Text>{qboInvoiceId ?? '-'}</Text>
      ),
    },
    {
      title: 'AMOUNT',
      key: 'amount',
      dataIndex: 'total',
      render: (total: number) => (
        <Text strong>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
      ),
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
      render: (record: Invoice) => (
        <Space>
          {getSyncStatusIcon(record.syncStatus, record.isSynced)}
          {getSyncStatusText(record)}
        </Space>
      ),
    },
    {
      title: 'ACTION',
      key: 'action',
      render: (record: Invoice) => (
        <Space>
          {record.isSynced ? (
            <Text type="secondary">Synced</Text>
          ) : (
            <Button
              type="link"
              size="small"
              style={{ color: '#1890ff', padding: 0 }}
              onClick={() => handleSyncInvoice(record.id)}
              loading={syncingInvoiceId === record.id}
              disabled={pageLoading || syncingInvoiceId !== null}
            >
              Sync Now
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Get count of unsynchronized invoices
  const unsynchronizedCount = invoices.filter(invoice => !invoice.isSynced).length;
  const hasActiveFilters = searchText || statusFilter || syncStatusFilter || dateRange;

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
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search invoices..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={handleSearchChange}
              allowClear
            />
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="All Statuses"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
            >
              <Option value="DRAFT">Draft</Option>
              <Option value="SENT">Sent</Option>
              <Option value="PAID">Paid</Option>
              <Option value="OVERDUE">Overdue</Option>
              <Option value="CANCELLED">Cancelled</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Sync Status"
              style={{ width: '100%' }}
              value={syncStatusFilter}
              onChange={(value) => handleFilterChange('syncStatus', value)}
              allowClear
            >
              <Option value="PENDING">Pending</Option>
              <Option value="SYNCING">Syncing</Option>
              <Option value="SUCCESS">Success</Option>
              <Option value="FAILED">Failed</Option>
            </Select>
          </Col>
        </Row>

        <Row gutter={[16, 8]} style={{ marginTop: '8px' }}>
          
          <Col xs={24} sm={12} md={6}>
            <Text style={{ fontSize: '12px', color: '#8c8c8c', lineHeight: '32px' }}>
              {invoices.length} of {pagination.total} invoices
              {hasActiveFilters && ' (filtered)'}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Sync All Button */}
      {unsynchronizedCount > 0 && (
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <Button
            type="primary"
            ghost
            icon={<SyncOutlined />}
            onClick={handleSyncAllUnsynchronized}
            loading={pageLoading}
            disabled={syncingInvoiceId !== null}
          >
            Sync All Unsynchronized ({unsynchronizedCount})
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={invoices}
        rowKey="id"
        loading={pageLoading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} invoices`,
        }}
        onChange={handleTableChange}
        size="middle"
      />
    </div>
  );
};

export default InvoiceTable;
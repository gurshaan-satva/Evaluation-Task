import { useState, useEffect } from 'react';
import {
    Table,
    Input,
    Select,
    Button,
    Space,
    Typography,
    message,
    Tag,
    DatePicker,
    Card,
    Statistic,
    Row,
    Col,
    Tooltip,
    Badge,
    Empty,
    Spin
} from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import {
    ArrowLeftOutlined,
    ReloadOutlined,
    SearchOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    DollarOutlined,
    SwapOutlined,
    UserOutlined,
    BankOutlined,
    AppstoreOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    FilterOutlined,
    ClearOutlined
} from '@ant-design/icons';
import { getSyncLogs } from '../api/syncLogs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Types
interface SyncLog {
    id: string;
    syncId: string;
    transactionType: 'INVOICE' | 'PAYMENT' | 'CUSTOMER' | 'ITEM' | 'ACCOUNT' | 'CHART_OF_ACCOUNT';
    systemTransactionId: string;
    quickbooksId: string | null;
    status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'IN_PROGRESS' | 'RETRY' | 'CANCELLED';
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
    qboConnectionId: string;
    invoiceId: string | null;
    paymentId: string | null;
    errorMessage: string | null;
    errorCode: string | null;
    timestamp: string;
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: string | null;
    createdAt: string;
    updatedAt: string;
    invoice: {
        docNumber: string;
        total: number;
        status: string;
    } | null;
    payment: {
        referenceNumber: string;
        amount: number;
        status: string;
    } | null;
}

interface SyncLogSummary {
    totalLogs: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
    inProgressCount: number;
    invoiceLogs: number;
    paymentLogs: number;
    createOperations: number;
    updateOperations: number;
    deleteOperations: number;
    averageDuration: number;
    recentActivity: number;
    successRate: number;
}

interface ApiResponse {
    syncLogs: SyncLog[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
    filters: {
        transactionType: string | null;
        status: string | null;
        operation: string | null;
        dateFrom: string | null;
        dateTo: string | null;
        systemTransactionId: string | null;
        quickbooksId: string | null;
        search: string | null;
    };
    sorting: {
        sortBy: string;
        sortOrder: 'asc' | 'desc';
    };
    summary: SyncLogSummary;
}

const SyncLogComponent = () => {
    const [loading, setLoading] = useState(false);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [summary, setSummary] = useState<SyncLogSummary | null>(null);

    // Filter states
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
    const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
    const [operationFilter, setOperationFilter] = useState<string | undefined>(undefined);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [systemTransactionId, setSystemTransactionId] = useState('');
    const [quickbooksId, setQuickbooksId] = useState('');

    // Sorting states
    const [sortBy, setSortBy] = useState('timestamp');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination states
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (total: number, range: [number, number]) =>
            `${range[0]}-${range[1]} of ${total} logs`,
    });

    useEffect(() => {
        fetchSyncLogs();
    }, [
        pagination.current,
        pagination.pageSize,
        searchText,
        statusFilter,
        typeFilter,
        operationFilter,
        dateRange,
        systemTransactionId,
        quickbooksId,
        sortBy,
        sortOrder
    ]);

    const fetchSyncLogs = async () => {
        try {
            setLoading(true);

            const params: any = {
                page: pagination.current,
                limit: pagination.pageSize,
                sortBy,
                sortOrder
            };

            if (searchText.trim()) params.search = searchText.trim();
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.transactionType = typeFilter;
            if (operationFilter) params.operation = operationFilter;
            if (systemTransactionId.trim()) params.systemTransactionId = systemTransactionId.trim();
            if (quickbooksId.trim()) params.quickbooksId = quickbooksId.trim();

            if (dateRange) {
                params.dateFrom = dateRange[0].startOf('day').toISOString();
                params.dateTo = dateRange[1].endOf('day').toISOString();
            }

            const response = await getSyncLogs(params);

            if (response.data.status === 'success') {
                const data: ApiResponse = response.data.data;
                setSyncLogs(data.syncLogs);
                setSummary(data.summary);
                setPagination(prev => ({
                    ...prev,
                    total: data.pagination.totalCount,
                }));
            }
        } catch (error) {
            console.error('Error fetching sync logs:', error);
            message.error('Failed to load sync logs');

            // Fallback to mock data for demo
            setSyncLogs([
                {
                    id: "1",
                    syncId: "sync-1",
                    transactionType: "PAYMENT",
                    systemTransactionId: "PMT-002",
                    quickbooksId: null,
                    status: "PENDING",
                    operation: "CREATE",
                    qboConnectionId: "conn-1",
                    invoiceId: null,
                    paymentId: "pay-1",
                    errorMessage: null,
                    errorCode: null,
                    timestamp: "2025-08-25T10:00:00.000Z",
                    startedAt: "2025-08-25T10:00:00.000Z",
                    completedAt: null,
                    duration: null,
                    retryCount: 0,
                    maxRetries: 3,
                    nextRetryAt: null,
                    createdAt: "2025-08-25T10:00:00.000Z",
                    updatedAt: "2025-08-25T10:00:00.000Z",
                    invoice: null,
                    payment: { referenceNumber: "PMT-002", amount: 510.79, status: "COMPLETED" }
                }
            ]);

            setSummary({
                totalLogs: 4,
                successCount: 2,
                failedCount: 1,
                pendingCount: 1,
                inProgressCount: 0,
                invoiceLogs: 2,
                paymentLogs: 2,
                createOperations: 4,
                updateOperations: 0,
                deleteOperations: 0,
                averageDuration: 567,
                recentActivity: 2,
                successRate: 50
            });
        } finally {
            setLoading(false);
        }
    };

    const resetAllFilters = () => {
        setSearchText('');
        setStatusFilter(undefined);
        setTypeFilter(undefined);
        setOperationFilter(undefined);
        setDateRange(null);
        setSystemTransactionId('');
        setQuickbooksId('');
        setSortBy('timestamp');
        setSortOrder('desc');
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();

        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;

        return {
            date: `${month} ${day}, ${year}`,
            time: `${displayHours}:${minutes} ${ampm}`
        };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'green';
            case 'FAILED': return 'red';
            case 'PENDING': return 'gold';
            case 'IN_PROGRESS': return 'blue';
            case 'RETRY': return 'orange';
            case 'CANCELLED': return 'default';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'FAILED':
                return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
            case 'PENDING':
                return <ClockCircleOutlined style={{ color: '#faad14' }} />;
            case 'IN_PROGRESS':
                return <Spin size="small" />;
            case 'RETRY':
                return <ReloadOutlined style={{ color: '#fa8c16' }} />;
            default:
                return null;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'INVOICE':
                return <FileTextOutlined style={{ color: '#1890ff' }} />;
            case 'PAYMENT':
                return <DollarOutlined style={{ color: '#52c41a' }} />;
            case 'CUSTOMER':
                return <UserOutlined style={{ color: '#722ed1' }} />;
            case 'ITEM':
                return <AppstoreOutlined style={{ color: '#eb2f96' }} />;
            case 'ACCOUNT':
            case 'CHART_OF_ACCOUNT':
                return <BankOutlined style={{ color: '#13c2c2' }} />;
            default:
                return null;
        }
    };


    const getSyncStatusText = (log: SyncLog) => {
        if (log.status === 'SUCCESS') {
            const timeAgo = getTimeAgo(new Date(log.completedAt || log.timestamp));
            return (
                <div>
                    <div style={{ color: '#52c41a', fontWeight: 500 }}>Successfully synced</div>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{timeAgo}</div>
                </div>
            );
        } else if (log.status === 'FAILED') {
            return (
                <div>
                    <div style={{ color: '#ff4d4f', fontWeight: 500 }}>
                        {log.errorMessage || 'Sync failed'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        {log.errorCode ? `Error: ${log.errorCode}` : 'Failed to sync'}
                    </div>
                </div>
            );
        } else if (log.status === 'IN_PROGRESS') {
            return (
                <div>
                    <div style={{ color: '#1890ff', fontWeight: 500 }}>In progress</div>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Currently syncing</div>
                </div>
            );
        } else if (log.status === 'RETRY') {
            return (
                <div>
                    <div style={{ color: '#fa8c16', fontWeight: 500 }}>Retrying</div>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        Attempt {log.retryCount + 1} of {log.maxRetries}
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

    const handleTableChange = (paginationConfig: any, filters: any, sorter: any) => {
        setPagination({
            ...pagination,
            current: paginationConfig.current,
            pageSize: paginationConfig.pageSize,
        });

        if (sorter.field && sorter.order) {
            setSortBy(sorter.field);
            setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
        }
    };
    const columns = [
        {
            title: 'TIMESTAMP',
            dataIndex: 'timestamp',
            key: 'timestamp',
            sortOrder: sortBy === 'timestamp' ? (sortOrder === 'asc' ? 'ascend' : 'descend') as SortOrder : undefined,
            render: (timestamp: string) => {
                const { date, time } = formatTimestamp(timestamp);
                return (
                    <Space direction="vertical" size={0}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <ClockCircleOutlined style={{ color: '#d9d9d9', marginRight: 8 }} />
                            <Text style={{ fontSize: '14px', fontWeight: 500 }}>{date}</Text>
                        </div>
                        <Text style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: 20 }}>{time}</Text>
                    </Space>
                );
            },
        },
        {
            title: 'TYPE',
            dataIndex: 'transactionType',
            key: 'transactionType',
            render: (type: string) => (
                <Space>
                    {getTypeIcon(type)}
                    <Text>{type.charAt(0) + type.slice(1).toLowerCase()}</Text>
                </Space>
            ),
        },
        {
            title: 'ENTITY ID',
            dataIndex: 'systemTransactionId',
            key: 'systemTransactionId',
            render: (id: string, record: SyncLog) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{id}</Text>
                </Space>
            ),
        },
        {
            title: 'QUICKBOOKS ID',
            dataIndex: 'quickbooksId',
            key: 'quickbooksId',
            render: (id: string | null) => (
                <Text style={{ color: id ? '#262626' : '#8c8c8c' }}>
                    {id || 'N/A'}
                </Text>
            ),
        },
        {
            title: 'ACTION',
            dataIndex: 'operation',
            key: 'operation',
            render: (operation: string) => (
                <Tag color={operation === 'CREATE' ? 'green' : operation === 'UPDATE' ? 'blue' : 'red'}>
                    {operation}
                </Tag>
            ),
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            render: (status: string, record: SyncLog) => (
                <Space>
                    <Tag color={getStatusColor(status)}>
                        {status === 'SUCCESS' ? 'Success' :
                            status === 'FAILED' ? 'Failed' :
                                status === 'IN_PROGRESS' ? 'In Progress' :
                                    status === 'RETRY' ? 'Retrying' :
                                        status === 'CANCELLED' ? 'Cancelled' : 'Pending'}
                    </Tag>
                    {record.retryCount > 0 && (
                        <Badge count={record.retryCount} size="small" />
                    )}
                </Space>
            ),
        },
        {
            title: 'DETAILS',
            key: 'details',
            render: (record: SyncLog) => (
                <Space>
                    {getStatusIcon(record.status)}
                    {getSyncStatusText(record)}
                </Space>
            ),
        },
    ];

    const hasActiveFilters = searchText || statusFilter || typeFilter || operationFilter ||
        dateRange || systemTransactionId || quickbooksId;

    return (
        <div style={{
            padding: '24px', minHeight: '100vh',
            background: '#f5f5f5',
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div>
                            <Title level={2} style={{ marginBottom: '8px', fontWeight: 600 }}>
                                QuickBooks Sync Log
                            </Title>
                            <Text style={{ fontSize: '16px', color: '#8c8c8c', marginTop: '4px', display: 'block' }}>
                                View all synchronization activities with QuickBooks
                            </Text>
                        </div>
                        <Space>
                            <Button
                                type="default"
                                icon={<ArrowLeftOutlined />}
                                onClick={() => window.history.back()}
                            >
                                Back to Dashboard
                            </Button>
                            <Button
                                type="default"
                                icon={<ReloadOutlined />}
                                onClick={fetchSyncLogs}
                                loading={loading}
                            >
                                Refresh
                            </Button>
                        </Space>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <Row gutter={16} style={{ marginBottom: '24px' }}>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="Total Logs"
                                    value={summary.totalLogs}
                                    prefix={<FileTextOutlined />}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="Success Rate"
                                    value={summary.successRate}
                                    suffix="%"
                                    prefix={<CheckCircleOutlined />}
                                    valueStyle={{ color: summary.successRate > 80 ? '#3f8600' : summary.successRate > 50 ? '#faad14' : '#cf1322' }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="Recent Activity (24h)"
                                    value={summary.recentActivity}
                                    prefix={<ReloadOutlined />}
                                />
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* Filters */}
                <Card
                    title={
                        <Space>
                            <FilterOutlined />
                            <Text strong>Filter Sync Logs</Text>
                            {hasActiveFilters && <Badge dot />}
                        </Space>
                    }
                    style={{ marginBottom: '24px' }}
                    extra={
                        <Button
                            onClick={resetAllFilters}
                            icon={<ClearOutlined />}
                            disabled={!hasActiveFilters}
                        >
                            Reset All
                        </Button>
                    }
                >
                    <Row gutter={[16, 16]}>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>Status</Text>
                            </div>
                            <Select
                                style={{ width: '100%' }}
                                value={statusFilter}
                                onChange={setStatusFilter}
                                allowClear
                                placeholder="All Statuses"
                            >
                                <Option value="SUCCESS">Success</Option>
                                <Option value="FAILED">Failed</Option>
                                <Option value="PENDING">Pending</Option>
                                <Option value="IN_PROGRESS">In Progress</Option>
                                <Option value="RETRY">Retrying</Option>
                                <Option value="CANCELLED">Cancelled</Option>
                            </Select>
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>Transaction Type</Text>
                            </div>
                            <Select
                                style={{ width: '100%' }}
                                value={typeFilter}
                                onChange={setTypeFilter}
                                allowClear
                                placeholder="All Types"
                            >
                                <Option value="INVOICE">Invoice</Option>
                                <Option value="PAYMENT">Payment</Option>
                            </Select>
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>Operation</Text>
                            </div>
                            <Select
                                style={{ width: '100%' }}
                                value={operationFilter}
                                onChange={setOperationFilter}
                                allowClear
                                placeholder="All Operations"
                            >
                                <Option value="CREATE">Create</Option>
                                <Option value="UPDATE">Update</Option>
                                <Option value="DELETE">Delete</Option>
                                <Option value="READ">Read</Option>
                            </Select>
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>Date Range</Text>
                            </div>
                            <RangePicker
                                style={{ width: '100%' }}
                                value={dateRange}
                                onChange={(dates) => {
                                    if (dates && dates[0] && dates[1]) {
                                        setDateRange([dates[0], dates[1]]);
                                    } else {
                                        setDateRange(null);
                                    }
                                }}
                                format="YYYY-MM-DD"
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>System Transaction ID</Text>
                            </div>
                            <Input
                                placeholder="e.g., INV-001"
                                value={systemTransactionId}
                                onChange={(e) => setSystemTransactionId(e.target.value)}
                                allowClear
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>QuickBooks ID</Text>
                            </div>
                            <Input
                                placeholder="e.g., 123456789"
                                value={quickbooksId}
                                onChange={(e) => setQuickbooksId(e.target.value)}
                                allowClear
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={6}>
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong>Sort By</Text>
                            </div>
                            <Space.Compact style={{ width: '100%' }}>
                                <Select
                                    style={{ width: '70%' }}
                                    value={sortBy}
                                    onChange={setSortBy}
                                >
                                    <Option value="timestamp">Timestamp</Option>
                                    <Option value="status">Status</Option>
                                    <Option value="transactionType">Type</Option>
                                    <Option value="operation">Operation</Option>
                                    <Option value="systemTransactionId">System ID</Option>
                                    <Option value="quickbooksId">QB ID</Option>
                                    <Option value="duration">Duration</Option>
                                    <Option value="retryCount">Retries</Option>
                                </Select>
                                <Button
                                    style={{ width: '30%' }}
                                    icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                >
                                    {sortOrder === 'asc' ? 'ASC' : 'DESC'}
                                </Button>
                            </Space.Compact>
                        </Col>
                    </Row>

                    <div style={{ marginTop: '16px' }}>
                        <Text style={{ fontSize: '14px', color: '#8c8c8c' }}>
                            Showing {syncLogs.length} of {pagination.total} logs
                            {hasActiveFilters && ' (filtered)'}
                        </Text>
                    </div>
                </Card>

                {/* Table */}
                {syncLogs.length === 0 && !loading ? (
                    <Card>
                        <Empty
                            description="No sync logs found"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    </Card>
                ) : (
                    <Card>
                        <Table
                            columns={columns}
                            dataSource={syncLogs}
                            rowKey="id"
                            loading={loading}
                            pagination={pagination}
                            onChange={handleTableChange}
                            size="middle"
                            scroll={{ x: 'max-content' }}
                        />
                    </Card>
                )}
            </div>
        </div>
    );
};

export default SyncLogComponent;
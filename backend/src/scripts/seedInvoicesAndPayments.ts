// backend\src\scripts\seedInvoicesAndPayments.ts
import { PrismaClient, InvoiceStatus, PaymentStatus, PaymentMethod, SyncStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Sample line items for invoices
const sampleLineItems = [
    {
        itemRef: "", // Will be populated dynamically
        itemName: "",
        description: "Web Development Services",
        quantity: 1,
        unitPrice: 2500.00,
        amount: 2500.00,
        detailType: "SalesItemLineDetail"
    },
    {
        itemRef: "",
        itemName: "",
        description: "Consulting Services",
        quantity: 10,
        unitPrice: 150.00,
        amount: 1500.00,
        detailType: "SalesItemLineDetail"
    },
    {
        itemRef: "",
        itemName: "",
        description: "Software License",
        quantity: 1,
        unitPrice: 500.00,
        amount: 500.00,
        detailType: "SalesItemLineDetail"
    }
];

// Generate random date within the last 90 days
const getRandomDate = (daysBack: number = 90): Date => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    return date;
};

// Generate due date (15-30 days after invoice date)
const getDueDate = (invoiceDate: Date): Date => {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 15) + 15);
    return dueDate;
};

// Generate document number
const generateDocNumber = (prefix: string, index: number): string => {
    return `${prefix}-${String(index + 1).padStart(4, '0')}`;
};

const seedInvoicesAndPayments = async () => {
    try {
        console.log('🌱 Starting to seed invoices and payments...');

        // Step 1: Get all active QBO connections
        const connections = await prisma.qBOConnection.findMany({
            where: { isConnected: true }
        });

        if (connections.length === 0) {
            console.log('❌ No active QBO connections found. Please connect to QuickBooks first.');
            return;
        }

        console.log(`📊 Found ${connections.length} active connection(s)`);

        for (const connection of connections) {
            console.log(`\n🏢 Processing connection: ${connection.companyName} (${connection.realmId})`);

            // Step 2: Get available customers, items, and accounts for this connection
            const customers = await prisma.customer.findMany({
                where: { 
                    qboConnectionId: connection.id,
                    active: true 
                },
                take: 10 // Limit to first 10 customers
            });

            const items = await prisma.item.findMany({
                where: { 
                    qboConnectionId: connection.id,
                    active: true,
                    type: { in: ['Service', 'Inventory'] } // Exclude categories
                },
                take: 10
            });

            const accounts = await prisma.chartOfAccount.findMany({
                where: { 
                    qboConnectionId: connection.id,
                    active: true,
                    accountType: { in: ['Bank', 'Other Current Asset', 'Cash'] } // Accounts suitable for payments
                },
                take: 5
            });

            if (customers.length === 0) {
                console.log(`⚠️  No customers found for connection ${connection.companyName}. Skipping...`);
                continue;
            }

            if (items.length === 0) {
                console.log(`⚠️  No items found for connection ${connection.companyName}. Skipping...`);
                continue;
            }

            if (accounts.length === 0) {
                console.log(`⚠️  No suitable accounts found for connection ${connection.companyName}. Skipping...`);
                continue;
            }

            console.log(`✅ Found ${customers.length} customers, ${items.length} items, ${accounts.length} accounts`);

            // Step 3: Create sample invoices
            const invoicesToCreate = Math.min(customers.length, 15); // Create up to 15 invoices
            const createdInvoices = [];

            console.log(`📝 Creating ${invoicesToCreate} sample invoices...`);

            for (let i = 0; i < invoicesToCreate; i++) {
                const customer = customers[i % customers.length];
                const invoiceDate = getRandomDate(60);
                const dueDate = getDueDate(invoiceDate);

                // Select 1-3 random items for this invoice
                const numLineItems = Math.floor(Math.random() * 3) + 1;
                const selectedItems = [];
                
                for (let j = 0; j < numLineItems; j++) {
                    const item = items[Math.floor(Math.random() * items.length)];
                    const quantity = Math.floor(Math.random() * 5) + 1;
                    const unitPrice = item.unitPrice || (Math.floor(Math.random() * 500) + 50);
                    
                    selectedItems.push({
                        itemRef: item.id,
                        itemName: item.name,
                        description: item.description || `${item.name} - Professional Service`,
                        quantity,
                        unitPrice,
                        amount: quantity * unitPrice,
                        detailType: "SalesItemLineDetail"
                    });
                }

                const subtotal = selectedItems.reduce((sum, item) => sum + item.amount, 0);
                const tax = subtotal * 0.08; // 8% tax
                const total = subtotal + tax;

                // Add tax line if applicable
                selectedItems.push({
                    itemRef: null,
                    itemName: "Tax",
                    description: "Sales Tax",
                    quantity: 1,
                    unitPrice: tax,
                    amount: tax,
                    detailType: "TaxLineDetail"
                });

                try {
                    const invoice = await prisma.invoice.create({
                        data: {
                            customerId: customer.id,
                            invoiceDate,
                            dueDate,
                            store: `Store ${Math.floor(Math.random() * 5) + 1}`,
                            billingAddress: customer.billingLine1 || `${customer.city}, ${customer.state}` || "123 Main St, Anytown, CA 90210",
                            docNumber: generateDocNumber('INV', i),
                            subtotal,
                            total,
                            sendLater: Math.random() > 0.7, // 30% chance of sendLater being true
                            status: i < 3 ? 'PAID' : (i < 8 ? 'SENT' : 'DRAFT'), // Mix of statuses
                            lineItems: selectedItems,
                            qboConnectionId: connection.id,
                            syncStatus: 'PENDING'
                        }
                    });

                    createdInvoices.push(invoice);
                    console.log(`  ✅ Created invoice ${invoice.docNumber} for customer ${customer.displayName}`);
                } catch (error) {
                    console.error(`  ❌ Failed to create invoice for customer ${customer.displayName}:`, error);
                }
            }

            // Step 4: Create payments for some invoices
            const paidInvoices = createdInvoices.filter(inv => inv.status === 'PAID');
            const partiallyPaidInvoices = createdInvoices.filter(inv => inv.status === 'SENT').slice(0, 3);
            
            console.log(`💰 Creating payments for ${paidInvoices.length + partiallyPaidInvoices.length} invoices...`);

            for (const invoice of [...paidInvoices, ...partiallyPaidInvoices]) {
                const paymentMethods: PaymentMethod[] = ['BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'ACH'];
                const selectedMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
                
                // For paid invoices, pay full amount. For others, pay partial amount
                const paymentAmount = invoice.status === 'PAID' 
                    ? invoice.total 
                    : invoice.total * (0.3 + Math.random() * 0.4); // 30-70% of total

                const paymentDate = new Date(invoice.invoiceDate);
                paymentDate.setDate(paymentDate.getDate() + Math.floor(Math.random() * 10) + 1); // 1-10 days after invoice

                const depositAccount = accounts[Math.floor(Math.random() * accounts.length)];

                try {
                    const payment = await prisma.payment.create({
                        data: {
                            invoiceId: invoice.id,
                            amount: Math.round(paymentAmount * 100) / 100, // Round to 2 decimal places
                            paymentDate,
                            paymentMethod: selectedMethod,
                            referenceNumber: `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            notes: `Payment via ${selectedMethod.toLowerCase().replace('_', ' ')} for invoice ${invoice.docNumber}`,
                            status: 'COMPLETED',
                            depositToAccountRef: depositAccount.id,
                            totalAmount: Math.round(paymentAmount * 100) / 100,
                            processPayment: true,
                            linkedTransactions: [
                                {
                                    TxnId: invoice.id,
                                    TxnType: "Invoice"
                                }
                            ],
                            qboConnectionId: connection.id,
                            syncStatus: 'PENDING'
                        }
                    });

                    console.log(`  💳 Created payment of $${payment.amount} for invoice ${invoice.docNumber}`);
                } catch (error) {
                    console.error(`  ❌ Failed to create payment for invoice ${invoice.docNumber}:`, error);
                }
            }

            // Step 5: Create some standalone payments (not linked to invoices)
            console.log(`💰 Creating 3 standalone payments...`);
            
            for (let i = 0; i < 3; i++) {
                const customer = customers[Math.floor(Math.random() * customers.length)];
                const paymentDate = getRandomDate(30);
                const amount = Math.round((Math.random() * 1000 + 100) * 100) / 100; // $100-$1100
                const depositAccount = accounts[Math.floor(Math.random() * accounts.length)];

                try {
                    // Create a dummy invoice first for the standalone payment
                    const dummyInvoice = await prisma.invoice.create({
                        data: {
                            customerId: customer.id,
                            invoiceDate: paymentDate,
                            dueDate: paymentDate,
                            docNumber: generateDocNumber('ADV', i),
                            subtotal: amount,
                            total: amount,
                            status: 'PAID',
                            lineItems: [
                                {
                                    itemRef: items[0].id,
                                    itemName: "Advance Payment",
                                    description: "Advance payment received",
                                    quantity: 1,
                                    unitPrice: amount,
                                    amount: amount,
                                    detailType: "SalesItemLineDetail"
                                }
                            ],
                            qboConnectionId: connection.id,
                            syncStatus: 'PENDING'
                        }
                    });

                    const payment = await prisma.payment.create({
                        data: {
                            invoiceId: dummyInvoice.id,
                            amount,
                            paymentDate,
                            paymentMethod: 'BANK_TRANSFER',
                            referenceNumber: `ADV-${Date.now()}-${i}`,
                            notes: `Advance payment from customer ${customer.displayName}`,
                            status: 'COMPLETED',
                            depositToAccountRef: depositAccount.id,
                            totalAmount: amount,
                            processPayment: true,
                            qboConnectionId: connection.id,
                            syncStatus: 'PENDING'
                        }
                    });

                    console.log(`  💰 Created standalone payment of $${payment.amount} from ${customer.displayName}`);
                } catch (error) {
                    console.error(`  ❌ Failed to create standalone payment:`, error);
                }
            }

            console.log(`✅ Completed seeding for connection: ${connection.companyName}`);
        }

        // Step 6: Display summary
        const totalInvoices = await prisma.invoice.count();
        const totalPayments = await prisma.payment.count();
        
        console.log('\n📊 SEEDING SUMMARY:');
        console.log(`📝 Total Invoices: ${totalInvoices}`);
        console.log(`💰 Total Payments: ${totalPayments}`);

        // Display invoice statuses
        const invoiceStats = await prisma.invoice.groupBy({
            by: ['status'],
            _count: {
                status: true
            }
        });

        console.log('\n📈 Invoice Status Breakdown:');
        invoiceStats.forEach(stat => {
            console.log(`  ${stat.status}: ${stat._count.status}`);
        });

        // Display payment methods
        const paymentStats = await prisma.payment.groupBy({
            by: ['paymentMethod'],
            _count: {
                paymentMethod: true
            }
        });

        console.log('\n💳 Payment Method Breakdown:');
        paymentStats.forEach(stat => {
            console.log(`  ${stat.paymentMethod}: ${stat._count.paymentMethod}`);
        });

        console.log('\n🎉 Invoice and payment seeding completed successfully!');

    } catch (error) {
        console.error('❌ Error during seeding:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
};

// Execute the seeding function
if (require.main === module) {
    seedInvoicesAndPayments()
        .catch((error) => {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}

export { seedInvoicesAndPayments };
// scripts/updatePaymentInvoiceMappings.ts

import { prisma } from '../config/db';
import paymentSyncService from '../service/paymentSyncService';

/**
 * Script to update existing payments with correct qboInvoiceId and linkedTransactions
 * This fixes payments that have null qboInvoiceId values by mapping them from related invoices
 */
async function updatePaymentInvoiceMappings() {
    try {
        console.log('🚀 Starting payment invoice mapping update...');

        // Get all QBO connections
        const connections = await prisma.qBOConnection.findMany({
            select: {
                id: true,
                realmId: true,
                accessToken: true,
                companyName: true
            }
        });

        if (connections.length === 0) {
            console.log('❌ No QBO connections found');
            return;
        }

        console.log(`📋 Found ${connections.length} QBO connections to process`);

        let totalProcessed = 0;
        let totalUpdated = 0;

        for (const connection of connections) {
            console.log(`\n🏢 Processing connection: ${connection.companyName} (${connection.realmId})`);
            
            try {
                const result = await paymentSyncService.updatePaymentInvoiceMappings(
                    connection.accessToken,
                    connection.realmId
                );

                console.log(`✅ ${result.message}`);
                totalProcessed += result.totalProcessed;
                totalUpdated += result.updatedCount;

            } catch (error) {
                console.error(`❌ Error processing connection ${connection.realmId}:`, error);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total payments processed: ${totalProcessed}`);
        console.log(`   Total payments updated: ${totalUpdated}`);
        console.log(`   Total payments skipped: ${totalProcessed - totalUpdated}`);

    } catch (error) {
        console.error('❌ Error in updatePaymentInvoiceMappings script:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script if called directly
if (require.main === module) {
    updatePaymentInvoiceMappings()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export default updatePaymentInvoiceMappings;

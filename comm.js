// =============================================================================
// 📦 نظام إدارة الطلبيات - comm.js
// =============================================================================

/**
 * نظام تسجيل وإدارة طلبيات الزبائن
 * يعمل مع localStorage ويدعم المزامنة مع Google Sheets
 */

const ORDERS_STORAGE_KEY = 'store_orders';

// =============================================================================
// 📋 إدارة الطلبيات
// =============================================================================

/**
 * تسجيل طلبية جديدة
 * @param {Object} orderData - بيانات الطلبية
 * @param {string} orderData.orderId - معرف الطلبية (فريد)
 * @param {string} orderData.customerName - اسم الزبون
 * @param {string} orderData.customerPhone - رقم الهاتف
 * @param {string} orderData.customerAddress - العنوان
 * @param {string} orderData.customerCommune - البلدية
 * @param {string} orderData.wilaya - الولاية
 * @param {string} orderData.deliveryType - نوع التوصيل (desk/home)
 * @param {Array} orderData.items - قائمة المنتجات
 * @param {number} orderData.subtotal - المجموع الفرعي
 * @param {number} orderData.discount - قيمة الخصم
 * @param {number} orderData.deliveryCost - تكلفة التوصيل
 * @param {number} orderData.total - المجموع الكلي
 * @param {number} orderData.totalPieces - عدد القطع
 * @param {boolean} orderData.isFreeDelivery - هل التوصيل مجاني؟
 * @param {string} orderData.status - حالة الطلبية (pending, confirmed, shipped, delivered, cancelled)
 * @param {string} orderData.notes - ملاحظات إضافية
 * @returns {Object} الطلبية المحفوظة مع معرف
 */
function registerOrder(orderData) {
    try {
        // توليد معرف فريد للطلبية إذا لم يتم توفيره
        const orderId = orderData.orderId || generateOrderId();
        
        // إنشاء كائن الطلبية الكامل
        const order = {
            orderId: orderId,
            timestamp: new Date().toISOString(),
            customerName: orderData.customerName || '',
            customerPhone: orderData.customerPhone || '',
            customerAddress: orderData.customerAddress || '',
            customerCommune: orderData.customerCommune || '',
            wilaya: orderData.wilaya || '',
            deliveryType: orderData.deliveryType || 'home',
            items: orderData.items || [],
            subtotal: orderData.subtotal || 0,
            discount: orderData.discount || 0,
            deliveryCost: orderData.deliveryCost || 0,
            total: orderData.total || 0,
            totalPieces: orderData.totalPieces || 0,
            isFreeDelivery: orderData.isFreeDelivery || false,
            status: orderData.status || 'pending',
            notes: orderData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // حفظ في localStorage
        const orders = getOrders();
        orders.unshift(order);
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));

        // محاولة المزامنة مع Google Sheets (إذا كان متصلاً بالإنترنت)
        if (navigator.onLine) {
            syncOrderToSheets(order).catch(err => {
                console.warn('⚠️ فشلت مزامنة الطلبية مع Google Sheets:', err);
            });
        }

        return order;
    } catch (error) {
        console.error('❌ خطأ في تسجيل الطلبية:', error);
        return null;
    }
}

/**
 * الحصول على جميع الطلبيات
 * @param {string} status - تصفية حسب الحالة (اختياري)
 * @returns {Array} قائمة الطلبيات
 */
function getOrders(status = null) {
    try {
        const data = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (!data) return [];
        
        const orders = JSON.parse(data);
        
        if (status) {
            return orders.filter(order => order.status === status);
        }
        
        return orders;
    } catch (error) {
        console.error('❌ خطأ في قراءة الطلبيات:', error);
        return [];
    }
}

/**
 * الحصول على طلبية بواسطة المعرف
 * @param {string} orderId - معرف الطلبية
 * @returns {Object|null} الطلبية أو null إذا لم توجد
 */
function getOrderById(orderId) {
    try {
        const orders = getOrders();
        return orders.find(order => order.orderId === orderId) || null;
    } catch (error) {
        console.error('❌ خطأ في البحث عن الطلبية:', error);
        return null;
    }
}

/**
 * تحديث حالة طلبية
 * @param {string} orderId - معرف الطلبية
 * @param {string} status - الحالة الجديدة
 * @param {string} notes - ملاحظات إضافية (اختياري)
 * @returns {Object|null} الطلبية المحدثة أو null
 */
function updateOrderStatus(orderId, status, notes = '') {
    try {
        const orders = getOrders();
        const index = orders.findIndex(order => order.orderId === orderId);
        
        if (index === -1) {
            console.error('❌ الطلبية غير موجودة:', orderId);
            return null;
        }

        const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            console.error('❌ حالة غير صالحة:', status);
            return null;
        }

        orders[index].status = status;
        orders[index].updatedAt = new Date().toISOString();
        
        if (notes) {
            orders[index].notes = (orders[index].notes ? orders[index].notes + '\n' : '') + notes;
        }
        
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));

        // محاولة المزامنة مع Google Sheets
        if (navigator.onLine) {
            syncOrderToSheets(orders[index]).catch(err => {
                console.warn('⚠️ فشلت مزامنة تحديث الطلبية:', err);
            });
        }

        return orders[index];
    } catch (error) {
        console.error('❌ خطأ في تحديث حالة الطلبية:', error);
        return null;
    }
}

/**
 * حذف طلبية
 * @param {string} orderId - معرف الطلبية
 * @returns {boolean} نجاح العملية
 */
function deleteOrder(orderId) {
    try {
        let orders = getOrders();
        const initialLength = orders.length;
        orders = orders.filter(order => order.orderId !== orderId);
        
        if (orders.length === initialLength) {
            console.warn('⚠️ الطلبية غير موجودة للحذف:', orderId);
            return false;
        }
        
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
        return true;
    } catch (error) {
        console.error('❌ خطأ في حذف الطلبية:', error);
        return false;
    }
}

/**
 * توليد معرف فريد للطلبية
 * @returns {string} معرف الطلبية
 */
function generateOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
}

/**
 * تصدير الطلبيات إلى CSV
 * @param {Array} orders - قائمة الطلبيات (اختياري، افتراضي: جميع الطلبيات)
 * @returns {string} محتوى CSV
 */
function exportOrdersToCSV(orders = null) {
    const data = orders || getOrders();
    
    if (data.length === 0) {
        return 'لا توجد طلبيات';
    }

    // رؤوس الأعمدة
    const headers = [
        'رقم الطلبية',
        'التاريخ',
        'الزبون',
        'الهاتف',
        'الولاية',
        'البلدية',
        'العنوان',
        'نوع التوصيل',
        'عدد القطع',
        'المجموع الفرعي',
        'الخصم',
        'تكلفة التوصيل',
        'المجموع الكلي',
        'الحالة',
        'الملاحظات'
    ];

    // بناء صفوف CSV
    const rows = data.map(order => [
        order.orderId,
        new Date(order.createdAt).toLocaleString('ar-DZ'),
        order.customerName,
        order.customerPhone,
        order.wilaya,
        order.customerCommune,
        order.customerAddress || '-',
        order.deliveryType === 'desk' ? 'للمكتب' : 'للمنزل',
        order.totalPieces,
        order.subtotal,
        order.discount,
        order.isFreeDelivery ? 'مجاني' : order.deliveryCost,
        order.total,
        getStatusArabic(order.status),
        order.notes || ''
    ]);

    // تجميع CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
}

/**
 * تصدير الطلبيات إلى JSON
 * @param {Array} orders - قائمة الطلبيات (اختياري)
 * @returns {string} محتوى JSON
 */
function exportOrdersToJSON(orders = null) {
    const data = orders || getOrders();
    return JSON.stringify(data, null, 2);
}

/**
 * الحصول على اسم الحالة بالعربية
 * @param {string} status - الحالة
 * @returns {string} اسم الحالة بالعربية
 */
function getStatusArabic(status) {
    const statusMap = {
        'pending': 'قيد الانتظار',
        'confirmed': 'مؤكد',
        'shipped': 'تم الشحن',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return statusMap[status] || status;
}

/**
 * الحصول على لون الحالة
 * @param {string} status - الحالة
 * @returns {string} لون الحالة (كود CSS)
 */
function getStatusColor(status) {
    const colorMap = {
        'pending': '#f8961e',    // برتقالي
        'confirmed': '#4361ee',  // أزرق
        'shipped': '#4cc9f0',    // سماوي
        'delivered': '#06d6a0',  // أخضر
        'cancelled': '#f72585'   // وردي
    };
    return colorMap[status] || '#8d99ae';
}

/**
 * الحصول على أيقونة الحالة
 * @param {string} status - الحالة
 * @returns {string} اسم أيقونة FontAwesome
 */
function getStatusIcon(status) {
    const iconMap = {
        'pending': 'fa-clock',
        'confirmed': 'fa-check-circle',
        'shipped': 'fa-truck',
        'delivered': 'fa-home',
        'cancelled': 'fa-times-circle'
    };
    return iconMap[status] || 'fa-question-circle';
}

/**
 * حساب إحصائيات الطلبيات
 * @returns {Object} إحصائيات الطلبيات
 */
function getOrdersStats() {
    const orders = getOrders();
    const totalOrders = orders.length;
    
    const stats = {
        total: totalOrders,
        pending: 0,
        confirmed: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenue: 0,
        totalPieces: 0,
        averageOrderValue: 0
    };

    orders.forEach(order => {
        if (stats[order.status] !== undefined) {
            stats[order.status]++;
        }
        
        if (order.status !== 'cancelled') {
            stats.totalRevenue += order.total || 0;
            stats.totalPieces += order.totalPieces || 0;
        }
    });

    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    stats.averageOrderValue = completedOrders > 0 ? stats.totalRevenue / completedOrders : 0;

    return stats;
}

/**
 * مزامنة الطلبية مع Google Sheets
 * @param {Object} order - الطلبية
 * @returns {Promise<boolean>} نجاح المزامنة
 */
async function syncOrderToSheets(order) {
    try {
        // التحقق من وجود URL لجداول Google
        const config = getStoreConfig();
        if (!config || !config.GOOGLE_SHEETS || !config.GOOGLE_SHEETS.url) {
            console.log('ℹ️ لم يتم تكوين Google Sheets للمزامنة');
            return false;
        }

        // تحضير بيانات الطلبية للإرسال
        const orderData = {
            orderId: order.orderId,
            timestamp: order.createdAt,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress,
            customerCommune: order.customerCommune,
            wilaya: order.wilaya,
            deliveryType: order.deliveryType,
            items: JSON.stringify(order.items),
            subtotal: order.subtotal,
            discount: order.discount,
            deliveryCost: order.deliveryCost,
            total: order.total,
            totalPieces: order.totalPieces,
            isFreeDelivery: order.isFreeDelivery,
            status: order.status,
            notes: order.notes,
            updatedAt: order.updatedAt
        };

        // إرسال إلى Google Sheets باستخدام Web App
        const response = await fetch(config.GOOGLE_SHEETS.url, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'addOrder',
                data: orderData
            })
        });

        // نظراً لأننا نستخدم mode: 'no-cors'، لا يمكننا قراءة الاستجابة
        console.log('✅ تم إرسال الطلبية للمزامنة مع Google Sheets');
        return true;

    } catch (error) {
        console.error('❌ فشلت مزامنة الطلبية مع Google Sheets:', error);
        return false;
    }
}

/**
 * استيراد الطلبيات من Google Sheets
 * @param {string} url - رابط Google Sheets (اختياري)
 * @returns {Promise<Array>} قائمة الطلبيات المستوردة
 */
async function importOrdersFromSheets(url = null) {
    try {
        const config = getStoreConfig();
        const sheetUrl = url || (config && config.GOOGLE_SHEETS ? config.GOOGLE_SHEETS.url : null);
        
        if (!sheetUrl) {
            console.warn('⚠️ لم يتم تحديد رابط Google Sheets');
            return [];
        }

        // استيراد الطلبيات من Google Sheets
        const response = await fetch(sheetUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // معالجة البيانات المستوردة
        if (data && data.orders) {
            const importedOrders = data.orders;
            
            // حفظ في localStorage
            let existingOrders = getOrders();
            const existingIds = new Set(existingOrders.map(o => o.orderId));
            
            let newOrders = 0;
            importedOrders.forEach(order => {
                if (!existingIds.has(order.orderId)) {
                    existingOrders.push(order);
                    newOrders++;
                }
            });
            
            if (newOrders > 0) {
                localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(existingOrders));
                console.log(`✅ تم استيراد ${newOrders} طلبية جديدة من Google Sheets`);
            }
            
            return importedOrders;
        }
        
        return [];

    } catch (error) {
        console.error('❌ خطأ في استيراد الطلبيات من Google Sheets:', error);
        return [];
    }
}

/**
 * الحصول على إعدادات المتجر من localStorage
 * @returns {Object|null} إعدادات المتجر
 */
function getStoreConfig() {
    try {
        const configData = localStorage.getItem('storeConfig');
        if (!configData) return null;
        return JSON.parse(configData);
    } catch (error) {
        console.error('❌ خطأ في قراءة إعدادات المتجر:', error);
        return null;
    }
}

// =============================================================================
// 📋 تصدير الوظائف للاستخدام في ملفات أخرى
// =============================================================================

// إذا كان النظام يستخدم CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        registerOrder,
        getOrders,
        getOrderById,
        updateOrderStatus,
        deleteOrder,
        generateOrderId,
        exportOrdersToCSV,
        exportOrdersToJSON,
        getOrdersStats,
        syncOrderToSheets,
        importOrdersFromSheets,
        getStatusArabic,
        getStatusColor,
        getStatusIcon
    };
}

#!/bin/bash

# سكريبت تشغيل المهام المجدولة مع متغيرات البيئة
# يستخدم مع Cron Jobs

# تحديد مسار المشروع
PROJECT_DIR="/home/ubuntu/erp-system"

# تحميل متغيرات البيئة من .env
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

# تحديد مسار Node.js
NODE_PATH=$(which node)

# الانتقال إلى مجلد المشروع
cd "$PROJECT_DIR"

# تشغيل المهمة المطلوبة
case "$1" in
    "daily-reminder")
        echo "$(date): بدء تشغيل التذكير اليومي..."
        $NODE_PATH scripts/scheduledTasks.mjs daily-reminder >> "$PROJECT_DIR/logs/daily-reminder.log" 2>&1
        ;;
    "weekly-report")
        echo "$(date): بدء تشغيل التقرير الأسبوعي..."
        $NODE_PATH scripts/scheduledTasks.mjs weekly-report >> "$PROJECT_DIR/logs/weekly-report.log" 2>&1
        ;;
    "all")
        echo "$(date): بدء تشغيل جميع المهام..."
        $NODE_PATH scripts/scheduledTasks.mjs all >> "$PROJECT_DIR/logs/all-tasks.log" 2>&1
        ;;
    *)
        echo "الاستخدام: $0 {daily-reminder|weekly-report|all}"
        exit 1
        ;;
esac

echo "$(date): اكتمل التشغيل"

# ใช้ PHP + Apache
FROM php:8.2-apache

# คัดลอกไฟล์ทั้งหมดเข้าไปในเว็บเซิร์ฟเวอร์
COPY . /var/www/html/

# เปิดสิทธิ์เขียนไฟล์ (ถ้ามีฟังก์ชัน save-db.php)
RUN chmod -R 777 /var/www/html

# เปิดพอร์ต 80 สำหรับ HTTP
EXPOSE 80

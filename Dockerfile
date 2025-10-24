# Dockerfile สำหรับ PHP + Apache (แก้ปัญหา DirectoryIndex, ServerName, permissions)
FROM php:8.2-apache

# ปิด warning โดยตั้ง ServerName
RUN printf '%s\n' "ServerName sub-estimator.onrender.com" > /etc/apache2/conf-available/servername.conf \
 && a2enconf servername
# เปิด mod_rewrite เผื่อ .htaccess/framework ต้องใช้
RUN a2enmod rewrite

# คัดลอกไฟล์โปรเจกต์เข้า DocumentRoot
COPY . /var/www/html/

# ตั้ง DirectoryIndex (ลำดับ: index.php ก่อน แล้ว index.html)
# หากไฟล์ dir.conf ไม่มีสตริงนั้น sed จะไม่ล้มเหลว (ใช้ || true)
RUN sed -i 's/DirectoryIndex .*/DirectoryIndex index.php index.html/g' /etc/apache2/mods-enabled/dir.conf || true

# ให้เจ้าของไฟล์เป็น www-data และสิทธิใช้ 755 (อ่านได้โดย apache)
RUN chown -R www-data:www-data /var/www/html && chmod -R 755 /var/www/html

EXPOSE 80
CMD ["apache2-foreground"]

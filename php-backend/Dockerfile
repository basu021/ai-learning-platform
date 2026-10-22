FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite \
 && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
 && sed -i 's/^Listen 80$/Listen 3001/' /etc/apache2/ports.conf \
 && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:3001>/' /etc/apache2/sites-available/000-default.conf \
 && printf 'upload_max_filesize = 26M\npost_max_size = 27M\n' > /usr/local/etc/php/conf.d/uploads.ini

COPY . /var/www/html/
RUN mkdir -p /app/uploads

EXPOSE 3001
# Uploads live on a volume; make sure Apache can write to it, then start.
CMD ["sh", "-c", "chown -R www-data:www-data /app/uploads && exec apache2-foreground"]

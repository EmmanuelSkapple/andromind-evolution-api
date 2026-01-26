#!/bin/bash

# Script de verificación de seguridad para Redis
# Verifica que Redis no esté expuesto públicamente

echo "=========================================="
echo "Verificación de Seguridad Redis"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Obtener IP pública del servidor
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)

if [ -z "$PUBLIC_IP" ]; then
    echo -e "${YELLOW}⚠️  No se pudo obtener la IP pública. Continuando con verificación local...${NC}"
    PUBLIC_IP="127.0.0.1"
fi

echo "IP Pública del servidor: $PUBLIC_IP"
echo ""

# Verificar si Redis está expuesto públicamente
echo "1. Verificando si Redis está expuesto públicamente..."
if command -v telnet &> /dev/null; then
    timeout 3 telnet $PUBLIC_IP 6379 &> /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${RED}❌ PELIGRO: Redis está accesible públicamente en $PUBLIC_IP:6379${NC}"
        echo -e "${RED}   Esto es un riesgo crítico de seguridad.${NC}"
        echo ""
        echo "   Soluciones:"
        echo "   1. Si usas Docker: elimina la sección 'ports' de redis en docker-compose.yaml"
        echo "   2. Si Redis está en el servidor: edita /etc/redis/redis.conf y cambia 'bind 0.0.0.0' a 'bind 127.0.0.1'"
        echo "   3. Configura firewall: sudo ufw deny 6379/tcp"
        exit 1
    else
        echo -e "${GREEN}✅ Redis NO está expuesto públicamente${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  telnet no está instalado. Instalando para verificación...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y telnet
    elif command -v yum &> /dev/null; then
        sudo yum install -y telnet
    fi
fi

echo ""

# Verificar acceso local
echo "2. Verificando acceso local a Redis..."
if command -v redis-cli &> /dev/null; then
    redis-cli -h localhost -p 6379 ping &> /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Redis está accesible localmente${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis no está accesible localmente (puede ser normal si está en Docker)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  redis-cli no está instalado. Saltando verificación local...${NC}"
fi

echo ""

# Verificar configuración de Docker
echo "3. Verificando configuración de Docker Compose..."
if [ -f "docker-compose.yaml" ]; then
    if grep -q "6379:6379" docker-compose.yaml && ! grep -q "127.0.0.1:6379:6379" docker-compose.yaml; then
        echo -e "${RED}❌ ADVERTENCIA: docker-compose.yaml expone Redis públicamente${NC}"
        echo "   Busca la línea con '6379:6379' y cámbiala a '127.0.0.1:6379:6379' o elimínala"
    elif grep -q "127.0.0.1:6379:6379" docker-compose.yaml; then
        echo -e "${GREEN}✅ Docker Compose está configurado para solo localhost${NC}"
    elif ! grep -q "6379" docker-compose.yaml; then
        echo -e "${GREEN}✅ Docker Compose NO expone Redis (mejor opción)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose.yaml no encontrado${NC}"
fi

echo ""

# Verificar firewall
echo "4. Verificando configuración del firewall..."
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "6379"; then
        if sudo ufw status | grep -q "DENY.*6379"; then
            echo -e "${GREEN}✅ Firewall bloquea el puerto 6379${NC}"
        else
            echo -e "${YELLOW}⚠️  El puerto 6379 está mencionado en el firewall pero no está bloqueado${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  El puerto 6379 no está configurado en el firewall${NC}"
        echo "   Considera ejecutar: sudo ufw deny 6379/tcp"
    fi
else
    echo -e "${YELLOW}⚠️  UFW no está instalado o no está activo${NC}"
fi

echo ""
echo "=========================================="
echo "Verificación completada"
echo "=========================================="
echo ""
echo "Si Redis está expuesto, consulta REDIS_SECURITY.md para soluciones detalladas."

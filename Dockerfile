FROM node:18-alpine

WORKDIR /app

# 애플리케이션 의존성 설치
COPY package*.json ./
RUN npm install

# 애플리케이션 소스 복사
COPY . .

# 포트 3000 노출
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"] 
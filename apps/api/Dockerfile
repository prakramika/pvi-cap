FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/api apps/api
COPY data data
WORKDIR /repo/apps/api
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace=@pvi-cap/api
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma node_modules/@prisma
COPY data data
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

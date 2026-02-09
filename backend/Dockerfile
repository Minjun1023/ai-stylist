FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

COPY . .

RUN chmod +x ./gradlew
RUN ./gradlew build -x test

CMD ["java", "-jar", "build/libs/ai-stylist-0.0.1-SNAPSHOT.jar"]

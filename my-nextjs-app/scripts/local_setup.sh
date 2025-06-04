#!/bin/bash
docker-compose up -d
telepresence intercept web --port 3000

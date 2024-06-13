#!/usr/bin/env bash
apt-get update
apt-get install -y wget gnupg
wget -qO - https://deb.nodesource.com/setup_16.x | bash -
apt-get install -y nodejs
apt-get install -y libx11-xcb1 libxtst6 libxrandr2 libxcomposite1 libasound2 libpangocairo-1.0-0 libcups2 libxss1 libnss3 libatk-bridge2.0-0 libx11-6

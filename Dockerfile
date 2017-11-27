FROM node:7
MAINTAINER	Henning Störk <stoerk+github@gmail.com>

# Update & Upgrade
RUN \
    apt-get update && \
    apt-get -y upgrade && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
RUN mkdir -p /usr/src/node-influx-uptimerobot
WORKDIR /usr/src

# Install app
RUN git clone https://github.com/Sillium/node-influx-uptimerobot
WORKDIR /usr/src/node-influx-uptimerobot

# Install app dependencies
RUN npm install

CMD node index.js
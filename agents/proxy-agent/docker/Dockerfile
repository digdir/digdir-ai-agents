FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl git jq ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# CRLF-stripp i tilfelle imaget bygges fra en Windows-checkout
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
  && chmod +x /usr/local/bin/entrypoint.sh

# Kjør som ikke-root ("node"-brukeren følger med basisimaget)
# /home/node/.pi må finnes med riktig eier i imaget, slik at named volume
# som mountes der arver node-eierskapet ved første oppstart
RUN mkdir -p /workspace /triggers /home/node/.pi/agent \
  && chown -R node:node /workspace /triggers /home/node/.pi
USER node
ENV HOME=/home/node

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["watch"]

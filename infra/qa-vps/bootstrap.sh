#!/usr/bin/env bash
# Hardens a fresh Ubuntu 24.04 AWS EC2 instance and installs Docker + Sysbox for the QA environment.
# Run once as root. Idempotent where practical. Read before running.
set -euo pipefail

SSH_PORT="${SSH_PORT:-2222}"
SYSBOX_VERSION="0.6.5"
SYSBOX_SHA256="${SYSBOX_SHA256:?set SYSBOX_SHA256 to the checksum published on the Sysbox release page}"

echo "==> base packages + unattended security upgrades"
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl gnupg ufw fail2ban unattended-upgrades auditd jq nodejs
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> deploy user (no password, docker group, restricted sudo)"
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> SSH hardening"
cat >/etc/ssh/sshd_config.d/10-hellosmart.conf <<EOF
Port ${SSH_PORT}
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
MaxAuthTries 3
X11Forwarding no
AllowTcpForwarding no
EOF
systemctl restart ssh

echo "==> firewall: SSH + HTTP(S) only"
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> fail2ban for sshd"
cat >/etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = ${SSH_PORT}
maxretry = 5
bantime = 1h
EOF
systemctl restart fail2ban

echo "==> kernel hardening"
cat >/etc/sysctl.d/99-hellosmart.conf <<'EOF'
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.tcp_syncookies = 1
EOF
sysctl --system >/dev/null

echo "==> Docker (official repo)"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" \
  >/etc/apt/sources.list.d/docker.list
apt-get update
apt-get -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker deploy
cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" },
  "live-restore": true,
  "no-new-privileges": true,
  "userland-proxy": false
}
EOF
systemctl restart docker

echo "==> Sysbox ${SYSBOX_VERSION} (workspace slots)"
cd /tmp
curl -fsSLO "https://downloads.nestybox.com/sysbox/releases/v${SYSBOX_VERSION}/sysbox-ce_${SYSBOX_VERSION}-0.linux_amd64.deb"
echo "${SYSBOX_SHA256}  sysbox-ce_${SYSBOX_VERSION}-0.linux_amd64.deb" | sha256sum -c -
apt-get -y install "./sysbox-ce_${SYSBOX_VERSION}-0.linux_amd64.deb"

echo "==> app directory"
install -d -m 750 -o deploy -g deploy /srv/hellosmart

echo
echo "Done. Next:"
echo "  1. add the CI deploy public key to /home/deploy/.ssh/authorized_keys"
echo "  2. create /srv/hellosmart/.env.qa (mode 600, owner deploy) from infra/qa-vps/env.qa.example"
echo "  3. SSH is now on port ${SSH_PORT} as user 'deploy' only"

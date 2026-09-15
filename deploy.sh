#!/bin/bash
set -e

git pull
sudo systemctl restart daily-tasks-api
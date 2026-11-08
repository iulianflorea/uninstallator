#!/bin/bash
# $1 == 0 înseamnă dezinstalare completă (nu actualizare)
if [ "${1:-0}" = "0" ]; then
    rm -f /usr/bin/dezinstalator
    rm -f /usr/share/polkit-1/actions/ro.singularity.dezinstalator.policy
fi
exit 0

#!/usr/bin/env bash
# Faux exécutable du banc LOT 9. Journalise, puis répond selon les fichiers d'état.
n="$(basename "$0")"
d="${FAKE_DIR:?}"
{ printf '%s' "$n"; for a in "$@"; do printf '\t%s' "$a"; done; printf '\n'; } >> "$d/calls.log"
heure='Mon 19 Oct 2026 09:00:00 AM EDT'
lire_dests() { if [ -f "$d/dests" ]; then cat "$d/dests"; fi; }   # NOM|enabled|accepting|URI|raison
case "$n" in
  lpstat)
    [ -f "$d/lpstat_denied" ] && { echo 'lpstat: Forbidden' >&2; exit 1; }
    mode="${1:-}"
    case "$mode" in
      -r)
        if [ -f "$d/down" ]; then echo 'lpstat: Unable to connect to server: Connection refused' >&2; exit 1; fi
        echo 'scheduler is running'; exit 0 ;;
      -d)
        premier="$(lire_dests | head -n 1 | cut -d'|' -f1)"
        [ -n "$premier" ] && echo "system default destination: $premier" || echo 'no system default destination'
        exit 0 ;;
      -l)
        # lpstat -l -p DEST : format reel de CUPS (ligne d'etat, raison si arretee, puis la configuration)
        cible="${3:-}"
        lire_dests | while IFS='|' read -r nom actif accept uri raison; do
          [ -z "$cible" ] || [ "$nom" = "$cible" ] || continue
          if [ "$actif" = "1" ]; then echo "printer $nom is idle.  enabled since $heure"
          else echo "printer $nom disabled since $heure -"; printf '\t%s\n' "${raison:-reason unavailable}"; fi
          printf '\tForm mounted:\n\tContent types: any\n\tPrinter types: unknown\n'
          printf '\tDescription: %s\n' "$nom"
          if [ "$actif" = "1" ]; then printf '\tAlerts: none\n'; else printf '\tAlerts: %s\n' "${raison:-none}"; fi
          printf '\tConnection: direct\n\tInterface: /etc/cups/ppd/%s.ppd\n' "$nom"
        done; exit 0 ;;
      -p)
        cible="${2:-}"
        lire_dests | while IFS='|' read -r nom actif accept uri raison; do
          [ -z "$cible" ] || [ "$nom" = "$cible" ] || continue
          if [ "$actif" = "1" ]; then echo "printer $nom is idle.  enabled since $heure"
          else echo "printer $nom disabled since $heure -"; printf '\t%s\n' "${raison:-reason unavailable}"; fi
        done; exit 0 ;;
      -a)
        cible="${2:-}"
        lire_dests | while IFS='|' read -r nom actif accept uri raison; do
          [ -z "$cible" ] || [ "$nom" = "$cible" ] || continue
          if [ "$accept" = "1" ]; then echo "$nom accepting requests since $heure"
          else echo "$nom not accepting requests since $heure"; fi
        done; exit 0 ;;
      -v)
        cible="${2:-}"
        lire_dests | while IFS='|' read -r nom actif accept uri raison; do
          [ -z "$cible" ] || [ "$nom" = "$cible" ] || continue
          echo "device for $nom: $uri"
        done; exit 0 ;;
      -o)
        cible="${2:-}"
        if [ -f "$d/jobs" ]; then
          while IFS='|' read -r ident proprio taille; do
            [ -n "$ident" ] || continue
            if [ -n "$cible" ]; then case "$ident" in "$cible"-*) ;; *) continue ;; esac; fi
            printf '%s %s %s %s\n' "$ident" "$proprio" "${taille:-1024}" "$heure"
          done < "$d/jobs"
        fi
        exit 0 ;;
      *) exit 0 ;;
    esac ;;
  cancel)
    [ -f "$d/cancel_fail" ] && { echo 'cancel: Forbidden' >&2; exit 1; }
    if [ ! -f "$d/noeffect_cancel" ] && [ -f "$d/jobs" ]; then
      # supprime la ligne dont le premier champ est exactement l'identifiant
      awk -F'|' -v id="$1" '$1 != id' "$d/jobs" > "$d/jobs.new"; mv "$d/jobs.new" "$d/jobs"
    fi
    exit 0 ;;
  cupsenable|cupsaccept)
    [ -f "$d/verb_fail" ] && { echo "$n: Forbidden" >&2; exit 1; }
    [ -f "$d/noeffect_verb" ] && exit 0
    awk -F'|' -v OFS='|' -v c="$1" -v v="$n" '$1==c { if (v=="cupsenable") $2=1; else $3=1 } {print}' "$d/dests" > "$d/dests.new"; mv "$d/dests.new" "$d/dests"
    exit 0 ;;
  systemctl)
    case "${1:-}" in
      is-active) if [ -f "$d/cups_inactive" ]; then echo inactive; exit 3; fi; echo active; exit 0 ;;
      *) exit 0 ;;
    esac ;;
  journalctl)
    [ -f "$d/journal_denied" ] && { echo 'Hint: You are currently not seeing messages from other users and the system.' >&2; exit 1; }
    echo 'Oct 19 09:00:00 vm cupsd[100]: fake journal line'; exit 0 ;;
  getent) echo "192.168.30.50     ${2:-hote}"; exit 0 ;;
  timeout)
    # timeout N cmd... : le test TCP est simulé (0 ouvert, 1 refusé, 124 délai).
    [ -f "$d/tcp" ] && exit "$(cat "$d/tcp")"
    exit 0 ;;
  sleep) exit 0 ;;
  *) exit 0 ;;   # lpadmin, cupsctl, lprm, lp, lpmove, service : journalisés, sans effet
esac

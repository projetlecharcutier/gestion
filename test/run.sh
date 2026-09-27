#!/bin/bash
# Runner global : execute tous les tests (ou une categorie : ./run.sh zombies).
# Les tests loopback utilisent des ports fixes : un seul test a la fois, les
# serveurs residues sont nettoyes entre chaque test.
cd "$(dirname "$0")/.." || exit 1

CAT="$1"
pass=0; fail=0; failed=""

if [ -n "$CAT" ]; then
  FILES=$(ls test/$CAT/*.js 2>/dev/null)
else
  FILES=$(ls test/*/*.js 2>/dev/null)
fi

for f in $FILES; do
  # Nettoyage des serveurs residuels : les tests loopback spawent des
  # serveurs sur des ports fixes ; un kill -9 laisse le socket en
  # TIME_WAIT et le test suivant sur le meme port echoue (ECONNREFUSED /
  # connexion refusee). On tue TOUT node restant (le test precedant est
  # termine, il ne reste que des residuels) et on laisse le temps au
  # port de se liberer.
  for pid in $(pgrep -f "node" 2>/dev/null); do
    [ "$pid" != "$$" ] && kill -9 "$pid" 2>/dev/null
  done
  sleep 1.5
  timeout 180 node "$f" >/tmp/test_out.txt 2>&1
  rc=$?
  if [ $rc -eq 0 ]; then
    pass=$((pass+1))
    echo "PASS  $f"
  else
    fail=$((fail+1)); failed="$failed $f"
    echo "FAIL  $f (rc=$rc)"
    tail -3 /tmp/test_out.txt | sed 's/^/      /'
  fi
done

ps aux | grep "[i]ndex.js" | grep -v grep | awk '{print $2}' | while read pid; do kill -9 "$pid" 2>/dev/null; done

echo "----------------------------------------"
echo "PASS: $pass  FAIL: $fail"
[ -n "$failed" ] && echo "Echecs:$failed"
exit $fail

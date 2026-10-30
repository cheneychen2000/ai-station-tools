/**
 * 统一测试结果收集器：PASS / FAIL / WARN / NOT RUN 四态。
 * 任何 FAIL 使进程退出码为 1（process.exitCode，不打断后续检查继续跑完）；
 * WARN / NOT RUN 不影响退出码，但不得冒充 PASS。
 */
export function createReporter(scope) {
  const results = [];
  const rec = (status, name, detail) => {
    results.push({ status, name, detail });
    console.log(`[${status}] ${name}${detail ? ' — ' + detail : ''}`);
  };
  return {
    pass: (name, detail) => rec('PASS', name, detail),
    fail: (name, detail) => rec('FAIL', name, detail),
    warn: (name, detail) => rec('WARN', name, detail),
    notRun: (name, reason) => rec('NOT RUN', name, reason),
    /** assert 简写：cond 真则 PASS 否则 FAIL */
    check(name, cond, detail) {
      cond ? this.pass(name, detail) : this.fail(name, detail || '断言不成立');
      return !!cond;
    },
    /** 汇总打印并设置退出码；返回是否全部通过 */
    summary() {
      const fails = results.filter(r => r.status === 'FAIL');
      const warns = results.filter(r => r.status === 'WARN');
      const notRuns = results.filter(r => r.status === 'NOT RUN');
      console.log('');
      console.log(`${scope}: ${results.length - fails.length - warns.length - notRuns.length} PASS / ${fails.length} FAIL / ${warns.length} WARN / ${notRuns.length} NOT RUN`);
      if (fails.length) {
        console.log('失败项：');
        for (const f of fails) console.log(`  FAIL ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
        process.exitCode = 1;
      }
      return fails.length === 0;
    }
  };
}

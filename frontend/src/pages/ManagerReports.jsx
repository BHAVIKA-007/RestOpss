import styles from './ManagerPages.module.css'

function ManagerReports() {
  return (
    <div>
      <header className={styles.pageHeading}>
        <p className={styles.eyebrow}>Manager workspace</p>
        <h1>Reports, when you need them.</h1>
        <p>Analytics are taking shape. This space will become your rhythm check for the restaurant.</p>
      </header>
      <section className={styles.reportNotice}><span className={styles.panelKicker}>Coming soon</span><h2>Reports and analytics are coming soon.</h2><p>There is no reporting endpoint yet, so these numbers are intentionally not live.</p></section>
      <div className={styles.reportGrid}>
        {['Table turnover', 'Revenue / day', 'Top items'].map((label) => <div className={`${styles.panel} ${styles.mockCard}`} key={label}><span className={styles.statLabel}>{label}</span><strong>&mdash;</strong><span>Not available yet</span></div>)}
      </div>
    </div>
  )
}

export default ManagerReports

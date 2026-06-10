import TaskCard from "./TaskCard";

export default function TaskListPanel({ tasks, hrefForTask = null, title = "任务列表", subtitle = "" }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{subtitle || `${tasks.length} 条需要处理`}</span>
      </div>
      <div className="task-grid">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} href={hrefForTask ? hrefForTask(task) : null} />
        ))}
        {tasks.length === 0 && <p className="empty">今天暂时没有需要处理的跟进任务。</p>}
      </div>
    </section>
  );
}

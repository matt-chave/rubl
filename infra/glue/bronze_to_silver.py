"""
Rebuild silver Parquet from bronze JSON.

Bronze is the durable landing zone (Firehose JSONL). Silver is a later
projection: the same envelope, columnar, rebuildable. A spec change must
not lose the bronze object — rerun this job after you fix the transform.
"""

import sys

from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ["JOB_NAME", "BRONZE_PATH", "SILVER_PATH"])

sc = SparkContext()
glue_context = GlueContext(sc)
spark = glue_context.spark_session
job = Job(glue_context)
job.init(args["JOB_NAME"], args)

bronze = args["BRONZE_PATH"]
silver = args["SILVER_PATH"]

df = spark.read.option("recursiveFileLookup", "true").json(bronze)
if df.rdd.isEmpty():
    raise Exception(
        "Bronze prefix is empty. POST /movements, wait for Firehose (~60s), then rerun."
    )

# Replace silver so a second run does not duplicate rows.
glue_context.purge_s3_path(silver, {"retentionPeriod": 0})

dyf = DynamicFrame.fromDF(df, glue_context, "bronze_events")
sink = glue_context.getSink(
    path=silver,
    connection_type="s3",
    updateBehavior="UPDATE_IN_DATABASE",
    enableUpdateCatalog=True,
    transformation_ctx="silver_sink",
)
sink.setFormat("glueparquet")
sink.setCatalogInfo(
    catalogDatabase="dwt_lake",
    catalogTableName="silver_waste_movement_events",
)
sink.writeFrame(dyf)

job.commit()

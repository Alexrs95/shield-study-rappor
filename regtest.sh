#!/bin/bash

set -o nounset
set -o pipefail
set -o errexit

. util.sh

readonly THIS_DIR=$(dirname $0)
readonly REPO_ROOT=$THIS_DIR
readonly CLIENT_DIR=$REPO_ROOT/client/python
# subdirs are in _tmp/$impl, which shouldn't overlap with anything else in _tmp
readonly REGTEST_BASE_DIR=_tmp

# All the Python tools need this
export PYTHONPATH=$CLIENT_DIR

# Generate a single test case, specified by a line of the test spec.
# This is a helper function for _run_tests().
_setup-one-case() {
  local impl=$1
  shift  # impl is not part of the spec; the next 13 params are

  local test_case=$1

  # input params
  local dist=$2
  local num_unique_values=$3
  local num_clients=$4
  local values_per_client=$5

  # RAPPOR params
  local num_bits=$6
  local num_hashes=$7
  local num_cohorts=$8
  local p=$9
  local q=${10}  # need curly braces to get the 10th arg
  local f=${11}

  # map params
  local num_additional=${12}
  local to_remove=${13}

  banner 'Setting up parameters and candidate files for '$test_case

  local case_dir=$REGTEST_BASE_DIR/$impl/$test_case
  mkdir -p $case_dir

  # Save the "spec"
  echo "$@" > $case_dir/spec.txt

  local params_path=$case_dir/case_params.csv

  echo 'k,h,m,p,q,f' > $params_path
  echo "$num_bits,$num_hashes,$num_cohorts,$p,$q,$f" >> $params_path

  print-unique-values $num_unique_values > $case_dir/case_unique_values.txt

  local true_map_path=$case_dir/case_true_map.csv

  bin/hash_candidates.py \
    $params_path \
    < $case_dir/case_unique_values.txt \
    > $true_map_path

  # banner "Constructing candidates"

  print-candidates \
    $case_dir/case_unique_values.txt $num_unique_values \
    $num_additional "$to_remove" \
    > $case_dir/case_candidates.txt

  # banner "Hashing candidates to get 'map'"

  bin/hash_candidates.py \
    $params_path \
    < $case_dir/case_candidates.txt \
    > $case_dir/case_map.csv
}

print-unique-values() {
  local num_unique_values=$1
  seq 1 $num_unique_values | awk '{print "v" $1}'
}

analysis() {
  banner "Summing RAPPOR IRR bits to get 'counts'"

  bin/sum_bits.py \
    $case_dir/case_params.csv \
    < $instance_dir/case_reports.csv \
    > $instance_dir/case_counts.csv

  local out_dir=${instance_dir}_report
  mkdir -p $out_dir

  # Currently, the summary file shows and aggregates timing of the inference
  # engine, which excludes R's loading time and reading of the (possibly 
  # substantial) map file. Timing below is more inclusive.
  TIMEFORMAT='Running compare_dist.R took %R seconds'
  time {
    # Input prefix, output dir
    bin/compare_dist.R -t "Test case: $test_case (instance $test_instance)" \
                         "$case_dir/case" "$instance_dir/case" $out_dir $num_clients $values_per_client
  }
}